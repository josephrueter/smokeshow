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
  hrrr,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const smokeLayerRef = useRef(null);
  const markerRef = useRef(null);
  const frameRef = useRef(null); // { meta, vA, vB, changedAt, hrrrMode }
  const hrrrOverlaysRef = useRef(null); // { a, b } L.imageOverlay pair for crossfade
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
      // Overlays die with the map — a stale ref here would leave the remounted
      // map (StrictMode, location change) updating orphaned layers forever.
      hrrrOverlaysRef.current = null;
      smokeLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridTiers[tier]) onNeedTier?.(tier);
  }, [tier, gridTiers, onNeedTier]);

  useEffect(() => {
    if (!smokeLayerRef.current || !mapRef.current) return;
    // Render the active tier; while it loads, fall back to the nearest fetched
    // one so zooming out never blanks the smoke layer.
    const data = gridTiers[tier] || gridTiers[tier - 1] || gridTiers[tier + 1] || gridTiers[1];
    if (!data) return;

    const meta = gridMeta(data);
    const lastIdx = data[0].pm25.length - 1;
    const timeA = data[0].timesUTC[selectedIndex];
    const timeB = data[0].timesUTC[Math.min(selectedIndex + 1, lastIdx)];

    // Prefer the sharp HRRR frame when one exists for this hour; the CAMS
    // canvas field is the everywhere-else and past-the-run fallback.
    const urlA = hrrr?.frameByTime.get(timeA) ?? null;
    const urlB = hrrr?.frameByTime.get(timeB) ?? urlA;
    const hrrrMode = !!urlA;

    if (hrrrMode) {
      if (!hrrrOverlaysRef.current) {
        const bounds = [
          [hrrr.manifest.bounds.latS, hrrr.manifest.bounds.lonW],
          [hrrr.manifest.bounds.latN, hrrr.manifest.bounds.lonE],
        ];
        hrrrOverlaysRef.current = {
          a: L.imageOverlay(urlA, bounds, { opacity: 1, interactive: false }).addTo(
            mapRef.current,
          ),
          b: L.imageOverlay(urlB, bounds, { opacity: 0, interactive: false }).addTo(
            mapRef.current,
          ),
        };
      } else {
        hrrrOverlaysRef.current.a.setUrl(urlA).setOpacity(1);
        hrrrOverlaysRef.current.b.setUrl(urlB).setOpacity(0);
      }
    } else if (hrrrOverlaysRef.current) {
      hrrrOverlaysRef.current.a.setOpacity(0);
      hrrrOverlaysRef.current.b.setOpacity(0);
    }
    smokeLayerRef.current.setVisible(!hrrrMode);

    const vA = frameValues(data, meta, selectedIndex);
    const vB = frameValues(data, meta, Math.min(selectedIndex + 1, lastIdx));
    frameRef.current = { meta, vA, vB, changedAt: performance.now(), hrrrMode };

    // Always draw the exact hour on step: when playing, the rAF loop below
    // immediately takes over and blends toward the next hour — but if rAF is
    // throttled (hidden tab, low-power mode), this keeps playback stepping
    // instead of freezing the canvas while the clock advances.
    if (!hrrrMode) smokeLayerRef.current.setField(meta, vA, vA, 0);

    const centerPoint = (gridTiers[1] || data).find((p) => p.isCenter);
    const level = centerPoint ? levelForPM25(centerPoint.pm25[selectedIndex]) : null;
    const el = markerRef.current?.getElement();
    const label = el?.querySelector('.user-marker__label');
    if (label && level) label.textContent = level.name;
  }, [gridTiers, selectedIndex, tier, playing, hrrr]);

  useEffect(() => {
    if (!playing) return;
    let raf;
    const loop = () => {
      const f = frameRef.current;
      if (f) {
        const t = Math.min(1, (performance.now() - f.changedAt) / (frameMs || 600));
        if (f.hrrrMode && hrrrOverlaysRef.current) {
          // Crossfade between the two hourly HRRR images
          hrrrOverlaysRef.current.a.setOpacity(1 - t);
          hrrrOverlaysRef.current.b.setOpacity(t);
        } else if (!f.hrrrMode && smokeLayerRef.current) {
          smokeLayerRef.current.setField(f.meta, f.vA, f.vB, t);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, frameMs]);

  return <div className="smoke-map" ref={containerRef} />;
}
