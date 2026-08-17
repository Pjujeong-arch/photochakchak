const SEOUL = { lat: 37.5665, lon: 126.978 };

function localDay() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cacheKey() {
  return `photochak-sky:${localDay()}`;
}

/** @param {number} code */
export function skyFromCode(code) {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}

/** @param {string} token */
export function applySkyToken(token) {
  const [sky, day] = String(token || "").split(":");
  const root = document.documentElement;
  if (sky) root.dataset.sky = sky;
  if (day) root.dataset.day = day;
}

async function coordsFromIp(signal) {
  const res = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal });
  if (!res.ok) return null;
  const row = await res.json();
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Open-Meteo current weather. No API key. Location from IP, else Seoul.
 * @param {AbortSignal} [signal]
 */
export async function fetchSky(signal) {
  let coords = SEOUL;
  try {
    coords = (await coordsFromIp(signal)) || SEOUL;
  } catch {
    coords = SEOUL;
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}` +
    `&longitude=${coords.lon}&current=weather_code,is_day&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("weather");
  const data = await res.json();
  const code = Number(data?.current?.weather_code);
  const isDay = data?.current?.is_day !== 0;
  return `${skyFromCode(Number.isFinite(code) ? code : 3)}:${isDay ? "day" : "night"}`;
}

export function startWeatherTheme() {
  if (typeof document === "undefined") return;
  try {
    const cached = sessionStorage.getItem(cacheKey());
    if (cached) applySkyToken(cached);
  } catch {
    /* private mode */
  }
  const ac = new AbortController();
  fetchSky(ac.signal)
    .then((token) => {
      applySkyToken(token);
      try {
        sessionStorage.setItem(cacheKey(), token);
      } catch {
        /* private mode */
      }
    })
    .catch(() => {});
}
