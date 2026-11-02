/*
 * Groshkov Padel bot → dashboard (read-only).
 *
 * Reads bookings, prices and locations from the bot's Firestore through the public
 * REST API — the same way the bot's Mini App reads them. Only the fields the dashboard
 * needs are requested (no Telegram ids or usernames). Prices are calculated with the
 * same rules as the bot's admin screen.
 */
(() => {
  "use strict";
  // The bot's Firebase project id and web API key are entered in Settings → Coaching
  // and kept in the private sync — they are not stored in this public code.
  const APP_URL = "https://t.me/GroshkovPadelBot/groshkovpadel";
  const baseOf = (project) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
  const BOOKING_FIELDS = ["name", "dateKey", "day", "time", "duration", "status", "format", "formatIdx", "location", "courtType",
    "recurring", "subscriptionIncluded", "subscriptionPurchaseTotal", "subscriptionDiscount"];
  const FORMATS = ["Individual", "Split (2 people)", "Triple", "Group (4 people)", "Sparring match (3 people)"];
  const FORMAT_PEOPLE = [1, 2, 3, 4, 3];

  const dec = (v) => {
    if (!v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("mapValue" in v) return decFields(v.mapValue.fields || {});
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
    return null;
  };
  const decFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));

  async function getJSON(url) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const st = j.error && j.error.status;
      throw new Error(st === "PERMISSION_DENIED" ? "the bot’s database no longer allows reading" : `bot database ${r.status}`);
    }
    return j;
  }

  async function fetchAll({ project, apiKey } = {}) {
    if (!project || !apiKey) throw new Error("add the bot’s Firebase project ID and API key in Settings → Coaching");
    const BASE = baseOf(project), KEY = encodeURIComponent(apiKey);
    const mask = BOOKING_FIELDS.map((f) => `&mask.fieldPaths=${f}`).join("");
    const bookings = [];
    let page = "";
    for (let i = 0; i < 20; i++) {
      const j = await getJSON(`${BASE}/bookings?key=${KEY}&pageSize=300${mask}${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
      for (const d of j.documents || []) bookings.push({ ...decFields(d.fields || {}), id: d.name.split("/").pop() });
      if (!j.nextPageToken) break;
      page = j.nextPageToken;
    }
    const [prices, locations] = await Promise.all([
      getJSON(`${BASE}/config/prices?key=${KEY}`).then((j) => decFields(j.fields || {})).catch(() => ({})),
      getJSON(`${BASE}/config/locations?key=${KEY}`).then((j) => decFields(j.fields || {}).list || []).catch(() => []),
    ]);
    return { bookings, prices, locations, at: Date.now() };
  }

  /* ── Same rules as the bot ── */
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Old bookings were stored with a UTC date (one day early); `day` is always the local day
  function effectiveDateKey(b) {
    if (!b.dateKey || b.day == null) return b.dateKey;
    const [y, m, d] = b.dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (b.day !== date.getDate()) return keyOf(new Date(date.getTime() + 864e5));
    return b.dateKey;
  }
  // Recurring requests are held back until the Sunday before their week
  function isReleased(b, key) {
    if (!b.recurring || !key) return true;
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d), dow = date.getDay();
    const release = new Date(date); release.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1) - 1); release.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return now >= release;
  }
  function courtPrice(prices, locations, b, date) {
    if (!b.location || !b.time) return 0;
    const hour = parseInt(b.time.split(":")[0], 10);
    const field = date.getDay() === 0 || date.getDay() === 6 ? "weekend" : hour < 17 ? "before17" : "after17";
    const loc = (locations || []).find((l) => l.name === b.location);
    if (loc) {
      const block = (prices.courtByLocation || {})[loc.id];
      if (b.courtType && block && block[b.courtType] && block[b.courtType][field]) return Number(block[b.courtType][field]) || 0;
      if (block && block[field]) return Number(block[field]) || 0;
    }
    return Number((prices.courtGlobal || {})[field]) || 0;
  }
  function priceOf(prices, locations, b, date) {
    const people = b.formatIdx != null ? FORMAT_PEOPLE[b.formatIdx] || 1 : 1;
    const base = b.formatIdx != null ? Number((prices.formats || {})[b.formatIdx]) || 0 : 0;
    const mult = (b.duration || 60) / 60;
    const full = base * people * mult;
    const training = b.subscriptionIncluded ? 0
      : b.subscriptionPurchaseTotal ? Number(b.subscriptionPurchaseTotal)
      : b.subscriptionDiscount != null ? Math.floor((full * (1 - b.subscriptionDiscount)) / 100) * 100
      : Math.round(full);
    return { training, court: Math.round(courtPrice(prices, locations, b, date) * mult), subscription: !!(b.subscriptionIncluded || b.subscriptionPurchaseTotal || b.subscriptionDiscount != null) };
  }

  // → { "YYYY-MM-DD": [lesson, …] } in the dashboard's lesson shape
  function toLessonsByDate(data) {
    const out = {};
    if (!data || !data.bookings) return out;
    const prices = data.prices || {}, locations = data.locations || [];
    for (const b of data.bookings) {
      const key = effectiveDateKey(b);
      if (!key || !b.time) continue;
      if (b.status === "pending" && !isReleased(b, key)) continue;
      const [y, m, d] = key.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const p = priceOf(prices, locations, b, date);
      const loc = locations.find((l) => l.name === b.location);
      (out[key] ||= []).push({
        id: "bot:" + b.id, source: "bot", botStatus: b.status || "pending",
        time: b.time, client: b.name || "Client", sport: "padel", duration: b.duration || 60,
        place: b.location || "", courtType: b.courtType || null, mapsUrl: (loc && loc.mapsUrl) || "",
        format: b.formatIdx != null ? FORMATS[b.formatIdx] || b.format : b.format || "",
        price: p.training, court: p.court, subscription: p.subscription,
      });
    }
    return out;
  }

  window.PadelBot = { fetchAll, toLessonsByDate, APP_URL };
})();
