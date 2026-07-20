import L from 'leaflet';
import { smokeRGBA } from '../lib/rating.js';

// Sample resolution: one field sample per BLOCK px, scaled up with canvas
// smoothing. Small enough to look continuous, cheap enough for 60fps.
const BLOCK = 4;

// Continuous smoke field: bilinear interpolation of the PM2.5 grid onto a
// raster, plus temporal interpolation between two hourly frames (t: 0..1).
// This is what makes playback read as motion — the plume's gradients slide
// between what the model says at hour N and hour N+1, instead of 81 dots
// pulsing in place.
export class SmokeCanvasLayer extends L.Layer {
  constructor(options) {
    super(options);
    this._field = null;
  }

  // meta: { lat0, lon0, latStep, lonStep, size }; valuesA/valuesB: flat
  // Float64Array[size*size] for the two bracketing hours; t: blend 0..1.
  setField(meta, valuesA, valuesB, t) {
    this._field = { meta, valuesA, valuesB, t };
    this._redraw();
  }

  // Hidden while the sharper HRRR image frames cover the current hour.
  setVisible(visible) {
    if (this._canvas) this._canvas.style.display = visible ? '' : 'none';
  }

  onAdd(map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'smoke-canvas-layer');
    this._canvas.style.position = 'absolute';
    this._canvas.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on('moveend zoomend resize', this._reset, this);
    this._reset();
  }

  onRemove(map) {
    L.DomUtil.remove(this._canvas);
    map.off('moveend zoomend resize', this._reset, this);
  }

  _reset() {
    if (!this._map || !this._canvas) return;
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    this._redraw();
  }

  _redraw() {
    if (!this._canvas || !this._map || !this._field) return;
    const { meta, valuesA, valuesB, t } = this._field;
    const { lat0, lon0, latStep, lonStep, size } = meta;
    const w = this._canvas.width;
    const h = this._canvas.height;
    if (!w || !h) return;

    const bw = Math.ceil(w / BLOCK);
    const bh = Math.ceil(h / BLOCK);
    // NOTE: named _raster (not _off) — L.Evented defines an internal _off()
    // method, and shadowing it with a canvas breaks Leaflet's event cleanup.
    if (!this._raster || this._raster.width !== bw || this._raster.height !== bh) {
      this._raster = document.createElement('canvas');
      this._raster.width = bw;
      this._raster.height = bh;
      this._rasterCtx = this._raster.getContext('2d');
    }

    // Web Mercator: lon is linear in x, lat depends only on y — one projection
    // call per row/column instead of per sample.
    const lats = new Float64Array(bh);
    const lons = new Float64Array(bw);
    for (let by = 0; by < bh; by++) {
      lats[by] = this._map.containerPointToLatLng([0, by * BLOCK + BLOCK / 2]).lat;
    }
    for (let bx = 0; bx < bw; bx++) {
      lons[bx] = this._map.containerPointToLatLng([bx * BLOCK + BLOCK / 2, 0]).lng;
    }

    const img = this._rasterCtx.createImageData(bw, bh);
    const data = img.data;
    const n = size - 1;

    for (let by = 0; by < bh; by++) {
      const gi = (lats[by] - lat0) / latStep;
      if (gi < -0.5 || gi > n + 0.5) continue;
      for (let bx = 0; bx < bw; bx++) {
        const gj = (lons[bx] - lon0) / lonStep;
        if (gj < -0.5 || gj > n + 0.5) continue;

        const ci = Math.min(Math.max(gi, 0), n);
        const cj = Math.min(Math.max(gj, 0), n);
        const i0 = Math.min(Math.floor(ci), n - 1);
        const j0 = Math.min(Math.floor(cj), n - 1);
        const fi = ci - i0;
        const fj = cj - j0;
        const k00 = i0 * size + j0;
        const k10 = k00 + size;

        const a =
          valuesA[k00] * (1 - fi) * (1 - fj) +
          valuesA[k00 + 1] * (1 - fi) * fj +
          valuesA[k10] * fi * (1 - fj) +
          valuesA[k10 + 1] * fi * fj;
        const b =
          valuesB[k00] * (1 - fi) * (1 - fj) +
          valuesB[k00 + 1] * (1 - fi) * fj +
          valuesB[k10] * fi * (1 - fj) +
          valuesB[k10 + 1] * fi * fj;
        const v = a + (b - a) * t;

        const [r, g, bl, al] = smokeRGBA(v);
        // Soften the grid's outer boundary so the field doesn't end in a wall.
        const edge = Math.min(ci, cj, n - ci, n - cj);
        const fade = Math.min(1, (edge + 0.5) / 1.25);

        // Ash-grain stipple: a deterministic per-cell hash sprinkles darker
        // specks whose density scales with concentration. Density changes
        // read far more strongly than flat tint changes, so the field
        // visibly evolves hour to hour. Hash is position-only — no flicker
        // between frames, specks dissolve in/out as the field moves.
        const a01 = (al / 255) * fade;
        const hash = ((((bx * 73856093) ^ (by * 19349663)) >>> 0) % 1000) / 1000;
        const p = (by * bw + bx) * 4;
        if (hash < a01 * 0.45) {
          data[p] = Math.round(r * 0.7);
          data[p + 1] = Math.round(g * 0.7);
          data[p + 2] = Math.round(bl * 0.7);
          data[p + 3] = Math.min(255, Math.round(al * fade * 1.55 + 28));
        } else {
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = bl;
          data[p + 3] = Math.round(al * fade);
        }
      }
    }

    this._rasterCtx.putImageData(img, 0, 0);
    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._raster, 0, 0, w, h);
  }
}
