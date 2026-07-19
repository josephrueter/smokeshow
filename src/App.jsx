import { useEffect, useMemo, useRef, useState } from 'react';
import LocationBanner from './components/LocationBanner.jsx';
import LocationSearch from './components/LocationSearch.jsx';
import RatingChip from './components/RatingChip.jsx';
import SmokeMap from './components/SmokeMap.jsx';
import Scrubber from './components/Scrubber.jsx';
import AgreementBand from './components/AgreementBand.jsx';
import FiveDayStrip from './components/FiveDayStrip.jsx';
import ForecastText from './components/ForecastText.jsx';
import Explainer from './components/Explainer.jsx';
import Disclaimer from './components/Disclaimer.jsx';

import { requestLocation, setManualLocation, clearLocation } from './lib/geolocation.js';
import { reverseGeocode } from './lib/geocoding.js';
import { buildGrid } from './lib/grid.js';
import { fetchGridPM25, findNowIndex } from './lib/openMeteo.js';
import { computeAgreement } from './lib/agreement.js';
import { buildForecastText } from './lib/forecastText.js';
import { levelForPM25 } from './lib/rating.js';
import { formatLocalTime } from './lib/time.js';
import { getJSON, setJSON } from './lib/storage.js';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const PLAY_INTERVAL_MS = 400;
const PREVIOUS_RUN_KEY = 'previousRun';
const LOCATION_MATCH_TOLERANCE_DEG = 0.05;

export default function App() {
  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState(null);
  const [gridData, setGridData] = useState(null);
  const [previousRun, setPreviousRun] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [nowIndex, setNowIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const playIntervalRef = useRef(null);

  useEffect(() => {
    requestLocation().then(setLocation);
  }, []);

  useEffect(() => {
    if (!location?.granted) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      if (location.label) {
        setPlaceName(location.label);
      } else {
        reverseGeocode(location.lat, location.lon).then((name) => {
          if (!cancelled) setPlaceName(name || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`);
        });
      }

      try {
        const points = buildGrid(location.lat, location.lon);
        const fetchedAtMs = Date.now();
        const grid = await fetchGridPM25(points);
        if (cancelled) return;

        const center = grid.find((p) => p.isCenter);
        const cachedPrev = getJSON(PREVIOUS_RUN_KEY);
        const usablePrev =
          cachedPrev &&
          Math.abs(cachedPrev.lat - location.lat) < LOCATION_MATCH_TOLERANCE_DEG &&
          Math.abs(cachedPrev.lon - location.lon) < LOCATION_MATCH_TOLERANCE_DEG
            ? cachedPrev
            : null;

        const hourlyAgreement = computeAgreement({
          timesUTC: center.timesUTC,
          pm25: center.pm25,
          fetchedAtMs,
          previousRun: usablePrev,
        });

        setJSON(PREVIOUS_RUN_KEY, {
          lat: location.lat,
          lon: location.lon,
          timesUTC: center.timesUTC,
          pm25: center.pm25,
          fetchedAtMs,
        });

        const nIdx = findNowIndex(center.timesUTC);

        setGridData(grid);
        setPreviousRun(usablePrev);
        setAgreement(hourlyAgreement);
        setNowIndex(nIdx);
        setSelectedIndex(nIdx);
      } catch (e) {
        if (!cancelled) setError('Could not load the forecast. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location]);

  const center = gridData?.find((p) => p.isCenter) ?? null;
  const windowStart = Math.max(0, nowIndex - 12);
  const windowEnd = center ? Math.min(center.timesUTC.length - 1, nowIndex + 48) : 0;

  useEffect(() => {
    clearInterval(playIntervalRef.current);
    if (!playing || !center) return;
    playIntervalRef.current = setInterval(() => {
      setSelectedIndex((idx) => (idx >= windowEnd ? windowStart : idx + 1));
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(playIntervalRef.current);
  }, [playing, windowStart, windowEnd, center]);

  const forecastText = useMemo(() => {
    if (!center) return '';
    return buildForecastText({
      timesUTC: center.timesUTC,
      pm25: center.pm25,
      nowIndex,
      timezone: TIMEZONE,
    });
  }, [center, nowIndex]);

  async function handleUpdateLocation() {
    setPlaying(false);
    clearLocation();
    setLocation(null);
    const loc = await requestLocation();
    setLocation(loc);
  }

  function handleManualSelect(result) {
    const loc = setManualLocation(result.lat, result.lon, result.label);
    setLocation(loc);
  }

  if (!location || (loading && !gridData)) {
    return (
      <div className="app app--loading">
        <p>{!location ? 'Requesting your location…' : 'Loading the forecast…'}</p>
      </div>
    );
  }

  if (!location.granted) {
    return (
      <div className="app">
        <h1 className="app__title">SMOKESHOW</h1>
        <LocationSearch onSelect={handleManualSelect} />
        <Disclaimer />
      </div>
    );
  }

  if (error || !center) {
    return (
      <div className="app app--error">
        <p>{error || 'Something went wrong loading the forecast.'}</p>
        <button type="button" onClick={handleUpdateLocation}>
          Try again
        </button>
      </div>
    );
  }

  const selectedPM25 = center.pm25[selectedIndex];
  const selectedLevel = levelForPM25(selectedPM25);

  return (
    <div className="app">
      <LocationBanner placeName={placeName} onUpdateLocation={handleUpdateLocation} />
      <RatingChip
        level={selectedLevel}
        pm25={selectedPM25}
        isNow={selectedIndex === nowIndex}
        timeLabel={formatLocalTime(center.timesUTC[selectedIndex], TIMEZONE)}
      />
      <SmokeMap gridData={gridData} selectedIndex={selectedIndex} center={location} />
      <Scrubber
        timesUTC={center.timesUTC}
        windowStart={windowStart}
        windowEnd={windowEnd}
        selectedIndex={selectedIndex}
        nowIndex={nowIndex}
        onScrub={setSelectedIndex}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        timezone={TIMEZONE}
      />
      <AgreementBand
        agreement={agreement}
        windowStart={windowStart}
        windowEnd={windowEnd}
        timesUTC={center.timesUTC}
        currentPM25={center.pm25}
        previousRun={previousRun}
      />
      <FiveDayStrip
        timesUTC={center.timesUTC}
        pm25={center.pm25}
        nowIndex={nowIndex}
        timezone={TIMEZONE}
      />
      <ForecastText text={forecastText} />
      <Explainer />
      <Disclaimer />
    </div>
  );
}
