/**
 * Live weather for 277 Park Ave #11, Youngstown, Ohio, from Open-Meteo (free, no API key, CORS-enabled).
 * Only the public coordinates of Youngstown are sent. Refreshed every 10 minutes; if the request fails the last known (or a default
 * snowy) weather is kept. `weather` is read by daycycle.js (sun strength, sky colour, fog) and the street view (snow / rain / wind).
 */
export const LOCATION = { name: '277 Park Ave #11', city: 'Youngstown, OH', lat: 41.0998, lon: -80.6495, tz: 'America/New_York' };

export const weather = {
  loaded: false, source: 'default', code: 73, label: 'Snow', tempF: 28, cloud: 100, windKmh: 12, windDir: 270,
  snow: 0.7, rain: 0, fog: 0, snowCover: 1,
};

const WMO = {
  0: ['Clear', 0, 0, 0], 1: ['Mostly clear', 0, 0, 0], 2: ['Partly cloudy', 0, 0, 0], 3: ['Overcast', 0, 0, 0],
  45: ['Fog', 0, 0, 0.85], 48: ['Freezing fog', 0, 0, 0.9],
  51: ['Light drizzle', 0, 0.25, 0], 53: ['Drizzle', 0, 0.4, 0], 55: ['Heavy drizzle', 0, 0.55, 0], 56: ['Freezing drizzle', 0.25, 0.3, 0], 57: ['Freezing drizzle', 0.35, 0.4, 0],
  61: ['Light rain', 0, 0.45, 0], 63: ['Rain', 0, 0.75, 0], 65: ['Heavy rain', 0, 1, 0], 66: ['Freezing rain', 0.25, 0.6, 0], 67: ['Freezing rain', 0.35, 0.9, 0],
  71: ['Light snow', 0.4, 0, 0], 73: ['Snow', 0.75, 0, 0], 75: ['Heavy snow', 1, 0, 0.15], 77: ['Snow grains', 0.5, 0, 0],
  80: ['Rain showers', 0, 0.5, 0], 81: ['Rain showers', 0, 0.8, 0], 82: ['Violent rain showers', 0, 1, 0], 85: ['Snow showers', 0.6, 0, 0], 86: ['Heavy snow showers', 1, 0, 0.1],
  95: ['Thunderstorm', 0, 1, 0], 96: ['Thunderstorm, hail', 0, 1, 0], 99: ['Thunderstorm, hail', 0, 1, 0],
};

export function setWeather(o) { Object.assign(weather, o); }

async function fetchOnce() {
  const { lat, lon, tz } = LOCATION;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=snow_depth&forecast_days=1&temperature_unit=fahrenheit&timezone=${encodeURIComponent(tz)}`;
  const r = await fetch(url); if (!r.ok) throw new Error('weather HTTP ' + r.status);
  const j = await r.json(), c = j.current, [label, snow, rain, fog] = WMO[c.weather_code] ?? ['Cloudy', 0, 0, 0];
  const hourIdx = Math.min(23, Math.max(0, Number(String(c.time).slice(11, 13)) || 0)), depth = j.hourly?.snow_depth?.[hourIdx];
  const cover = depth != null ? Math.min(1, depth / 0.04) : c.temperature_2m < 34 ? 0.8 : 0;
  setWeather({ loaded: true, source: 'open-meteo', code: c.weather_code, label, tempF: c.temperature_2m, cloud: c.cloud_cover, windKmh: c.wind_speed_10m, windDir: c.wind_direction_10m, snow, rain, fog, snowCover: Math.max(cover, snow > 0 ? 0.6 : 0) });
}

export function startWeather() {
  const go = () => fetchOnce().catch((e) => console.warn('[weather] using', weather.source, 'weather:', e.message));
  go(); setInterval(go, 10 * 60 * 1000);
}
