// Meteo da Open-Meteo: gratuito, senza registrazione e senza chiavi.

const CACHE = "armadio:meteo";

const CODICI = {
  0: ["Sereno", "☀️"], 1: ["Poco nuvoloso", "🌤️"], 2: ["Parzialmente nuvoloso", "⛅"], 3: ["Coperto", "☁️"],
  45: ["Nebbia", "🌫️"], 48: ["Nebbia", "🌫️"],
  51: ["Pioviggine", "🌦️"], 53: ["Pioviggine", "🌦️"], 55: ["Pioviggine", "🌦️"], 56: ["Pioggia gelata", "🌧️"], 57: ["Pioggia gelata", "🌧️"],
  61: ["Pioggia debole", "🌦️"], 63: ["Pioggia", "🌧️"], 65: ["Pioggia forte", "🌧️"], 66: ["Pioggia gelata", "🌧️"], 67: ["Pioggia gelata", "🌧️"],
  71: ["Neve debole", "🌨️"], 73: ["Neve", "🌨️"], 75: ["Neve forte", "❄️"], 77: ["Nevischio", "🌨️"],
  80: ["Rovesci", "🌦️"], 81: ["Rovesci", "🌧️"], 82: ["Rovesci forti", "⛈️"], 85: ["Rovesci di neve", "🌨️"], 86: ["Rovesci di neve", "❄️"],
  95: ["Temporale", "⛈️"], 96: ["Temporale con grandine", "⛈️"], 99: ["Temporale con grandine", "⛈️"]
};
export const descrizione = codice => CODICI[codice] || ["", "🌡️"];

export async function cercaCitta(nome) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?count=6&language=it&format=json&name=${encodeURIComponent(nome)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Ricerca non riuscita");
  const j = await r.json();
  return (j.results || []).map(x => ({
    nome: x.name,
    dove: [x.admin1, x.country].filter(Boolean).join(", "),
    lat: x.latitude, lon: x.longitude
  }));
}

export function posizioneAttuale() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error("Posizione non disponibile"));
    navigator.geolocation.getCurrentPosition(
      p => ok({ nome: "La mia posizione", dove: "", lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
      () => ko(new Error("Non ho il permesso di usare la posizione")),
      { timeout: 15000, maximumAge: 3600000 }
    );
  });
}

// Restituisce { giorni: { "2026-10-12": {...} }, aggiornato, offline }.
// "cache" separa il meteo di casa da quello della meta della vacanza.
export async function previsioni(citta, cache = CACHE) {
  const chiave = `${citta.lat},${citta.lon}`;
  let vecchio = null;
  try { vecchio = JSON.parse(localStorage.getItem(cache)); } catch {}
  if (vecchio?.chiave === chiave && Date.now() - vecchio.aggiornato < 30 * 60000) return vecchio;

  const u = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: citta.lat, longitude: citta.lon, timezone: "auto", past_days: 6, forecast_days: 16,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max"
  });
  try {
    const r = await fetch(u);
    if (!r.ok) throw new Error();
    const d = (await r.json()).daily;
    const giorni = {};
    d.time.forEach((data, i) => {
      giorni[data] = {
        codice: d.weather_code[i],
        tMin: d.temperature_2m_min[i], tMax: d.temperature_2m_max[i],
        percMin: d.apparent_temperature_min[i], percMax: d.apparent_temperature_max[i],
        pioggiaProb: d.precipitation_probability_max[i] ?? 0,
        pioggiaMm: d.precipitation_sum[i] ?? 0,
        vento: d.wind_speed_10m_max[i]
      };
    });
    const nuovo = { chiave, giorni, aggiornato: Date.now() };
    try { localStorage.setItem(cache, JSON.stringify(nuovo)); } catch {}
    return nuovo;
  } catch {
    if (vecchio?.chiave === chiave) return { ...vecchio, offline: true };
    throw new Error("Non riesco a scaricare il meteo: controlla la connessione");
  }
}
