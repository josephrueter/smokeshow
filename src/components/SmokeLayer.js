import L from 'leaflet';
import { smokeColorForPM25 } from '../lib/rating.js';

// Custom canvas overlay: renders smoke as smoke (a translucent gray -> brown ->
// near-black gradient blob per grid point) rather than an AQI-rainbow legend,
// so the basemap stays readable underneath and heavy smoke visibly darkens it.
export class SmokeCanvasLayer extends L.Layer {
  constructor(options) {
    super(options);
    this._points = [];
  }

  setData(points) {
    this._points = points;
    this._redraw();
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

  _estimateCellPx() {
    if (this._points.length < 2 || !this._map) return 40;
    const a = this._points.find((p) => p.i === 0 && p.j === 0) || this._points[0];
    const b = this._points.find((p) => p.i === 1 && p.j === 0) || this._points[1];
    const pa = this._map.latLngToContainerPoint([a.lat, a.lon]);
    const pb = this._map.latLngToContainerPoint([b.lat, b.lon]);
    return Math.max(20, Math.hypot(pa.x - pb.x, pa.y - pb.y));
  }

  _redraw() {
    if (!this._canvas || !this._map) return;
    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    const radius = this._estimateCellPx() * 0.85;
    for (const p of this._points) {
      if (p.pm25 == null) continue;
      const pt = this._map.latLngToContainerPoint([p.lat, p.lon]);
      const color = smokeColorForPM25(p.pm25);
      const gradient = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
