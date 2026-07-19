import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SmokeCanvasLayer } from './SmokeLayer.js';
import { levelForPM25 } from '../lib/rating.js';

// Three zoom tiers, each backed by its own grid (fetched lazily by App):
// tier 1 = 25km spacing (~200km square), tier 2 = 75km (~600km),
// tier 3 = 200km (~1600km, regional context).
export function tierForZoom(zoom) {
  if (zoom >= 8) return 1;
  if (zoom >= 6) return 2;
  return 3;
}

function gridMeta(points) {
  const size = Math.round(Math.sqrt(points.length));
  const half = Math.floor(size / 2);
  const p00 = points.find((p) => p.i === -half && p.j === -half);
  const p10 = points.find((p) => p.i === -half + 1 && p.j === -half);
  const p01 = points.find((p) => p.i === -half && p.j === -half + 1);
  return {
    lat0: p00.lat,
    lon0: p00.lon,
    latStep: p10.lat - p00.lat,
    lonStep: p01.lon - p00.lon,
    size,
    half,
  };
}

function frameValues(points, meta, hourIndex) {
  const arr = new Float64Array(meta.size * meta.size);
  for (const p of points) {
    arr[(p.i + meta.half) * meta.size + (p.j + meta.half)] = p.pm25[hourIndex] ?? 0;
  }
  return arr;
}

export default function SmokeMap({
  gridTiers,
  selectedIndex,
  center,
  onNeedTier,
  playing,
  frameMs,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const smokeLayerRef = useRef(null);
  const markerRef = useRef(null);
  const frameRef = useRef(null); // { meta, vA, vB, changedAt }
  const [tier, setTier] = useState(1);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, minZoom: 4 }).setView(
      [center.lat, center.lon],
      9,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const smokeLayer = new SmokeCanvasLayer();
    smokeLayer.addTo(map);
    smokeLayerRef.current = smokeLayer;

    const marker = L.marker([center.lat, center.lon], {
      icon: L.divIcon({
        className: 'user-marker',
        html: '<div class="user-marker__dot"></div><div class="user-marker__label"></div>',
        iconSize: [12, 12],
      }),
    }).addTo(map);
    markerRef.current = marker;

    map.on('zoomend', () => setTier(tierForZoom(map.getZoom())));

    if (import.meta.env.DEV) window.__smokeshowMap = map; // dev-only: lets tests drive zoom directly

    // Leaflet only measures its container once; if layout settles late (slow
    // devices, rotation, flex reflow) the map — and our canvas — stay 0-sized.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridTiers[tier]) onNeedTier?.(tier);
  }, [tier, gridTiers, onNeedTier]);

  useEffect(() => {
    if (!smokeLayerRef.current) return;
    // Render the active tier; while it loads, fall back to the nearest fetched
    // one so zooming out never blanks the smoke layer.
    const data = gridTiers[tier] || gridTiers[tier - 1] || gridTiers[tier + 1] || gridTiers[1];
    if (!data) return;

    const meta = gridMeta(data);
    const lastIdx = data[0].pm25.length - 1;
    const vA = frameValues(data, meta, selectedIndex);
    const vB = frameValues(data, meta, Math.min(selectedIndex + 1, lastIdx));
    frameRef.current = { meta, vA, vB, changedAt: performance.now() };

    // Always draw the exact hour on step: when playing, the rAF loop below
    // immediately takes over and blends toward the next hour — but if rAF is
    // throttled (hidden tab, low-power mode), this keeps playback stepping
    // instead of freezing the canvas while the clock advances.
    smokeLayerRef.current.setField(meta, vA, vA, 0);

    const centerPoint = (gridTiers[1] || data).find((p) => p.isCenter);
    const level = centerPoint ? levelForPM25(centerPoint.pm25[selectedIndex]) : null;
    const el = markerRef.current?.getElement();
    const label = el?.querySelector('.user-marker__label');
    if (label && level) label.textContent = level.name;
  }, [gridTiers, selectedIndex, tier, playing]);

  useEffect(() => {
    if (!playing) return;
    let raf;
    const loop = () => {
      const f = frameRef.current;
      if (f && smokeLayerRef.current) {
        const t = Math.min(1, (performance.now() - f.changedAt) / (frameMs || 600));
        smokeLayerRef.current.setField(f.meta, f.vA, f.vB, t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, frameMs]);

  return <div className="smoke-map" ref={containerRef} />;
}
