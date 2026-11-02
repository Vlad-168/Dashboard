// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: table-tennis;

/*
 * Dashboard — iPhone home screen widget (Scriptable)
 *
 * Shows today's training and lessons, the next tournament, your streak and GitHub
 * tasks — read from the same private sync (secret GitHub Gist) as the dashboard.
 * Works in small, medium and large sizes. Tap the widget to open the dashboard.
 *
 * Setup: run this script once inside Scriptable and paste your GitHub token
 * (it is kept in the iOS Keychain on this iPhone only). Then add a Scriptable
 * widget to the home screen and choose this script.
 */

const DASH_URL = "https://vlad-168.github.io/Dashboard/";
const FILE = "dashboard-sync.json";
const KC_TOKEN = "dashboard.token";
const KC_GIST = "dashboard.gist";

const C = {
  bg1: "#341a29", bg2: "#13090f", text: "#f8ecf2", muted: "#c2a5b3", faint: "#8b6e7c",
  accent: "#d293b0", accentBg: "#854c65", gold: "#f2c47e", tennis: "#c8db5e", padel: "#5ec4da",
  ok: "#8fd6a9", danger: "#e06c6c", line: "#3d2532",
};
const col = (h, a = 1) => new Color(h, a);

/* ───────────── Data ───────────── */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT = { mon: "Mo", tue: "Tu", wed: "We", thu: "Th", fri: "Fr", sat: "Sa", sun: "Su" };
const TYPE_ICON = { gym: "🏋️", tennis: "🎾", padel: "🏓", cardio: "🏃", mobility: "🧘", strength: "🏋️" };
const SPORT = { tennis: ["🎾", "Tennis"], padel: ["🏓", "Padel"] };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const byTime = (a, b) => (a.time || "").localeCompare(b.time || "");
const fmtDur = (m) => (!m ? "" : m < 60 ? `${m} min` : `${m / 60} h`);
const withIds = (map) => {
  const out = {};
  for (const k of Object.keys(map || {})) out[k] = (map[k] || []).map((x, i) => (x.id ? x : Object.assign({}, x, { id: `${k}-${i}` })));
  return out;
};

async function getToken() {
  if (Keychain.contains(KC_TOKEN)) return Keychain.get(KC_TOKEN);
  if (config.runsInWidget) return null;
  return askToken();
}
async function askToken() {
  const a = new Alert();
  a.title = "Dashboard widget";
  a.message = "Paste the same GitHub token you use in the dashboard. It is stored in the iOS Keychain on this iPhone only.";
  a.addSecureTextField("github_pat_…");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (!t) return null;
  Keychain.set(KC_TOKEN, t);
  if (Keychain.contains(KC_GIST)) Keychain.remove(KC_GIST);
  return t;
}

async function gh(path, token) {
  const r = new Request("https://api.github.com" + path);
  r.headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + token };
  const json = await r.loadJSON();
  const code = r.response && r.response.statusCode;
  if (code >= 400) {
    const e = new Error(code === 401 ? "Token rejected" : code === 403 || code === 404 ? "No Gists access" : "GitHub " + code);
    e.status = code;
    throw e;
  }
  return json;
}
async function findGist(token) {
  if (Keychain.contains(KC_GIST)) return Keychain.get(KC_GIST);
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`, token);
    const hit = list.find((g) => g.files && g.files[FILE]);
    if (hit) { Keychain.set(KC_GIST, hit.id); return hit.id; }
    if (list.length < 100) break;
  }
  throw new Error("Open the dashboard and sync once");
}
async function loadRecords(token) {
  let id = await findGist(token), g;
  try { g = await gh(`/gists/${id}`, token); }
  catch (e) { if (e.status !== 404) throw e; Keychain.remove(KC_GIST); id = await findGist(token); g = await gh(`/gists/${id}`, token); }
  const f = g.files[FILE];
  const text = f.truncated ? await new Request(f.raw_url).loadString() : f.content;
  return JSON.parse(text).records || {};
}
async function githubCount(user, token) {
  if (!user) return null;
  let n = 0;
  for (const kind of ["is:issue", "is:pr"]) {
    const q = encodeURIComponent(`is:open ${kind} assignee:${user} archived:false`);
    const r = await gh(`/search/issues?per_page=1&q=${q}`, token);
    n += r.total_count || 0;
  }
  return n;
}

// Cache so the widget still shows something offline
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "dashboard-widget-cache.json");
const readCache = () => { try { return JSON.parse(fm.readString(cachePath)); } catch (e) { return null; } };
const writeCache = (v) => { try { fm.writeString(cachePath, JSON.stringify(v)); } catch (e) {} };

function model(records, ghTasks) {
  const get = (k, f) => (records[k] && records[k].v != null ? records[k].v : f);
  const cfg = get("cfg", {}) || {};
  const schedule = withIds(cfg.schedule), lessons = withIds(cfg.lessons);
  const now = new Date();
  const workoutsFor = (d) => (schedule[DAY_KEYS[d.getDay()]] || []).slice().sort(byTime);
  const lessonsFor = (d) => (lessons[DAY_KEYS[d.getDay()]] || []).slice().sort(byTime);
  const isDone = (d, w) => get("done:" + ymd(d), []).includes(w.id);
  const lessonStatus = (d, l) => {
    const mark = get("lesson:" + ymd(d), {})[l.id];
    if (mark) return mark;
    const [h, m] = (l.time || "23:59").split(":").map(Number);
    const end = new Date(d); end.setHours(h || 0, (m || 0) + (+l.duration || 60), 0, 0);
    return now >= end ? "done" : "planned";
  };
  const minutes = (t) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const training = workoutsFor(now).map((w) => ({ w, done: isDone(now, w) }));
  const lessonsToday = lessonsFor(now).map((l) => ({ l, st: lessonStatus(now, l) }));

  // Next thing today: an undone training later today or the next planned lesson
  const cands = [];
  training.forEach(({ w, done }) => { if (!done && minutes(w.time) + (+w.duration || 60) > nowMin) cands.push({ kind: "training", time: w.time, title: w.title, meta: `${TYPE_ICON[w.type] || "🏋️"} ${fmtDur(w.duration)}`.trim() }); });
  lessonsToday.forEach(({ l, st }) => { if (st === "planned") cands.push({ kind: "lesson", time: l.time, title: l.client, meta: `${(SPORT[l.sport] || SPORT.tennis)[0]} ${l.place || (SPORT[l.sport] || SPORT.tennis)[1]}`, sport: l.sport }); });
  cands.sort(byTime);

  // Streak (rest days don't break it)
  let streak = 0;
  for (let i = 0, d = new Date(now); i < 365; i++, d = addDays(d, -1)) {
    const list = workoutsFor(d);
    if (!list.length) continue;
    if (list.every((w) => isDone(d, w))) streak++;
    else if (i === 0) continue;
    else break;
  }

  // Next tournament
  const todayK = ymd(now);
  const tour = get("tournaments", []).filter((t) => (t.to || t.from) >= todayK).sort((a, b) => a.from.localeCompare(b.from))[0];
  let tourWhen = "";
  if (tour) {
    const days = Math.round((parseYmd(tour.from) - parseYmd(todayK)) / 864e5);
    tourWhen = days <= 0 ? "on now" : days === 1 ? "tomorrow" : `in ${days} days`;
  }

  // Week dots and month earnings
  const mon = addDays(now, -((now.getDay() + 6) % 7));
  const week = WEEK.map((k, i) => {
    const d = addDays(mon, i);
    const tours = get("tournaments", []).filter((t) => t.from <= ymd(d) && ymd(d) <= (t.to || t.from)).length;
    return { k, d, today: ymd(d) === todayK, training: workoutsFor(d).map((w) => ({ done: isDone(d, w) })),
      lessons: lessonsFor(d).map((l) => ({ sport: l.sport, st: lessonStatus(d, l) })), tours };
  });
  let earned = 0;
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= now; d = addDays(d, 1)) {
    for (const l of lessonsFor(d)) if (lessonStatus(d, l) === "done") earned += +l.price || 0;
  }

  const h = now.getHours();
  const greet = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : h >= 17 && h < 23 ? "Good evening" : "Good night";
  return { now, name: cfg.name || "", greet, training, lessonsToday, next: cands[0], streak, tour, tourWhen, week, earned,
    currency: cfg.currency || "€", ghTasks };
}

/* ───────────── UI helpers ───────────── */
function text(stack, s, size, color, weight = "regular", lines = 1) {
  const t = stack.addText(String(s));
  const fonts = { regular: Font.systemFont, medium: Font.mediumSystemFont, semibold: Font.semiboldSystemFont, bold: Font.boldSystemFont,
    rounded: Font.semiboldRoundedSystemFont, serif: (n) => new Font("Georgia", n), serifItalic: (n) => new Font("Georgia-Italic", n) };
  t.font = (fonts[weight] || Font.systemFont)(size);
  t.textColor = col(color);
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.7;
  return t;
}
function hstack(parent, spacing = 0) { const s = parent.addStack(); s.layoutHorizontally(); s.spacing = spacing; s.centerAlignContent(); return s; }
function vstack(parent, spacing = 0) { const s = parent.addStack(); s.layoutVertically(); s.spacing = spacing; return s; }
function pill(parent, s, bg, fg, size = 10) {
  const p = parent.addStack();
  p.backgroundColor = col(bg); p.cornerRadius = 7; p.setPadding(2, 6, 2, 6);
  text(p, s, size, fg, "semibold");
  return p;
}
function dot(parent, color, size = 6) {
  const d = parent.addStack(); d.size = new Size(size, size); d.cornerRadius = size / 2; d.backgroundColor = col(color);
  return d;
}
function header(w, m, right) {
  const row = hstack(w);
  text(row, m.now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase(), 10, C.faint, "semibold");
  row.addSpacer();
  if (right) text(row, right, 10, C.muted, "semibold");
}
function sectionTitle(parent, s) { text(parent, s.toUpperCase(), 9, C.faint, "semibold"); }

function trainingRows(parent, m, max) {
  if (!m.training.length) { text(parent, "Rest day ☕", 12, C.muted); return; }
  m.training.slice(0, max).forEach(({ w, done }) => {
    const r = hstack(parent, 5);
    text(r, done ? "✓" : "○", 11, done ? C.ok : C.faint, "bold");
    text(r, w.time || "", 11, C.muted, "medium");
    text(r, w.title, 12, done ? C.faint : C.text, "semibold");
  });
  if (m.training.length > max) text(parent, `+${m.training.length - max} more`, 10, C.faint);
}
function lessonRows(parent, m, max) {
  if (!m.lessonsToday.length) { text(parent, "No lessons 🌴", 12, C.muted); return; }
  m.lessonsToday.slice(0, max).forEach(({ l, st }) => {
    const r = hstack(parent, 5);
    dot(r, st === "cancel" ? C.danger : l.sport === "padel" ? C.padel : C.tennis, 6);
    text(r, l.time || "", 11, C.muted, "medium");
    text(r, l.client, 12, st === "planned" ? C.text : C.faint, "semibold");
  });
  if (m.lessonsToday.length > max) text(parent, `+${m.lessonsToday.length - max} more`, 10, C.faint);
}
function footer(parent, m) {
  const row = hstack(parent, 6);
  if (m.tour) pill(row, `🏆 ${m.tour.title} · ${m.tourWhen}`, "#4a3622", C.gold);
  row.addSpacer();
  if (m.ghTasks != null) text(row, `GitHub ${m.ghTasks}`, 10, C.muted, "semibold");
  if (m.streak) text(row, `🔥 ${m.streak}`, 10, C.muted, "semibold");
}

/* ───────────── Widgets ───────────── */
function build(m, family, note) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [col(C.bg1), col(C.bg2)]; g.locations = [0, 1];
  g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.url = DASH_URL;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  if (family === "small") {
    w.setPadding(14, 14, 12, 14);
    header(w, m, m.streak ? `🔥${m.streak}` : "");
    w.addSpacer(6);
    if (m.next) {
      text(w, m.next.kind === "lesson" ? "NEXT LESSON" : "NEXT TRAINING", 9, C.accent, "semibold");
      text(w, m.next.time, 30, C.text, "serif");
      text(w, m.next.title, 13, C.text, "semibold", 2);
      text(w, m.next.meta, 11, C.muted);
    } else {
      const done = m.training.filter((x) => x.done).length;
      text(w, m.greet, 11, C.muted);
      text(w, m.name || "Today", 22, C.accent, "serifItalic");
      w.addSpacer(2);
      text(w, m.training.length ? `${done}/${m.training.length} training done` : "Rest day ☕", 12, C.text, "semibold", 2);
    }
    w.addSpacer();
    if (m.tour) text(w, `🏆 ${m.tourWhen}`, 10, C.gold, "semibold");
  } else {
    const large = family === "large";
    w.setPadding(14, 16, 12, 16);
    header(w, m, note || "");
    w.addSpacer(4);
    const hello = hstack(w, 0);
    text(hello, `${m.greet}${m.name ? "," : ""} `, large ? 20 : 15, C.text, "serif");
    if (m.name) text(hello, m.name, large ? 20 : 15, C.accent, "serifItalic");
    hello.addSpacer();
    w.addSpacer(large ? 10 : 6);

    const cols = hstack(w, 0);
    cols.topAlignContent();
    const left = vstack(cols, 4);
    cols.addSpacer(14);
    const right = vstack(cols, 4);
    cols.addSpacer();
    sectionTitle(left, "Training");
    trainingRows(left, m, large ? 4 : 3);
    left.addSpacer();
    sectionTitle(right, "Lessons");
    lessonRows(right, m, large ? 5 : 3);
    right.addSpacer();

    if (large) {
      w.addSpacer(10);
      sectionTitle(w, "This week");
      w.addSpacer(4);
      const wk = hstack(w, 0);
      m.week.forEach((d, i) => {
        if (i) wk.addSpacer();
        const c = vstack(wk, 3);
        c.centerAlignContent();
        c.setPadding(5, 6, 5, 6); c.cornerRadius = 9;
        if (d.today) c.backgroundColor = col(C.accentBg, 0.55);
        text(c, DAY_SHORT[d.k], 9, d.today ? C.text : C.faint, "semibold");
        text(c, d.d.getDate(), 12, C.text, "semibold");
        const dots = hstack(c, 2);
        d.training.slice(0, 3).forEach((t) => dot(dots, t.done ? C.accent : C.line, 5));
        const ldots = hstack(c, 2);
        d.lessons.slice(0, 3).forEach((l) => dot(ldots, l.st === "cancel" ? C.line : l.sport === "padel" ? C.padel : C.tennis, 5));
        if (d.tours) text(c, "🏆", 8, C.gold);
      });
      w.addSpacer(8);
      const earn = hstack(w, 6);
      text(earn, "Earned this month", 11, C.muted);
      earn.addSpacer();
      text(earn, `${Math.round(m.earned).toLocaleString("en-GB")} ${m.currency}`, 15, C.text, "serif");
    }
    w.addSpacer();
    footer(w, m);
  }
  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = col(C.bg2);
  w.setPadding(14, 14, 14, 14);
  w.url = DASH_URL;
  text(w, "Dashboard", 13, C.accent, "semibold");
  w.addSpacer(4);
  text(w, msg, 12, C.muted, "regular", 4);
  return w;
}

/* ───────────── Run ───────────── */
async function main() {
  const family = config.widgetFamily || "medium";
  const token = await getToken();
  if (!token) return errorWidget("Open Scriptable and run this script once to add your GitHub token.");
  let records, gh = null, note = "";
  try {
    records = await loadRecords(token);
    try { gh = await githubCount((records.cfg && records.cfg.v && records.cfg.v.github && records.cfg.v.github.username) || "", token); } catch (e) {}
    writeCache({ records, gh, at: Date.now() });
  } catch (e) {
    const cache = readCache();
    if (!cache) return errorWidget(e.message || "Couldn’t load your data");
    records = cache.records; gh = cache.gh;
    note = "offline";
  }
  return build(model(records, gh), family, note);
}

const widget = await main();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  const a = new Alert();
  a.title = "Dashboard widget";
  a.message = "Preview a size, or change the token.";
  ["Small", "Medium", "Large"].forEach((s) => a.addAction(s));
  a.addAction("Change token");
  a.addCancelAction("Done");
  const i = await a.present();
  if (i === 3) { await askToken(); }
  else if (i >= 0) {
    const fam = ["small", "medium", "large"][i];
    const token = await getToken();
    let w = widget;
    if (token) { try { w = build(model(await loadRecords(token), null), fam, ""); } catch (e) { const c = readCache(); if (c) w = build(model(c.records, c.gh), fam, "offline"); } }
    if (fam === "small") await w.presentSmall(); else if (fam === "large") await w.presentLarge(); else await w.presentMedium();
  }
}
Script.complete();
