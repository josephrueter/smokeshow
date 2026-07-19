const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export async function searchPlaces(query) {
  const q = query?.trim();
  if (!q || q.length < 2) return [];
  const url = `${SEARCH_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

// Open-Meteo's geocoding API is forward-search only (name -> coords); it has no
// reverse endpoint. BigDataCloud's free client-side reverse-geocode endpoint
// needs no API key and allows browser CORS, so it fills that gap without a backend.
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export async function reverseGeocode(lat, lon) {
  try {
    const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('reverse geocode request failed');
    const data = await res.json();
    const place = data.city || data.locality;
    const region = data.principalSubdivisionCode?.split('-')?.[1] || data.principalSubdivision;
    const parts = [place, region].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
}
