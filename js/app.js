(() => {
  "use strict";
  const { store, db, sync, token } = window.Dash;

  /* ═════════════════════════ Constants & helpers ═════════════════════════ */
  const BASE = window.DASHBOARD_CONFIG || {};
  const CFG_VERSION = 4;
  const LOCALE = "en-GB";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
  const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

  const TYPES = { gym: ["🏋️", "Gym"], tennis: ["🎾", "Tennis"], padel: ["🏓", "Padel"], cardio: ["🏃", "Cardio"], mobility: ["🧘", "Mobility"] };
  const LEGACY_TYPES = { strength: "gym", swim: "cardio", bike: "cardio" };
  const typeOf = (w) => (TYPES[w.type] ? w.type : LEGACY_TYPES[w.type] || "gym");
  const SPORTS = { tennis: ["🎾", "Tennis"], padel: ["🏓", "Padel"] };
  const sportOf = (l) => (SPORTS[l.sport] ? l.sport : "tennis");
  const ROLES = { play: "Playing", coach: "With my players" };

  const DEFAULT_SPACES = [
    { id: "work", name: "Work", icon: "💼", widgets: ["github", "todo", "focus", "today"], repos: [] },
    { id: "sport", name: "Training", icon: "🏋️", widgets: ["today", "tournaments", "week", "stats", "todo"] },
    { id: "coach", name: "Coaching", icon: "🎾", widgets: ["lessons", "lessonsWeek", "tournaments", "coachStats", "todo"] },
    { id: "life", name: "Personal", icon: "🌿", widgets: ["todo", "week", "focus"] },
  ];

  const THEMES = [
    { id: "damson", name: "Damson", a: "#854c65", b: "#1d0f17", c: "#3a2030", bar: "#1d0f17" },
    { id: "damson-light", name: "Damson Light", a: "#854c65", b: "#f7eef2", c: "#ffffff", bar: "#f7eef2" },
    { id: "noir", name: "Noir", a: "#e7e7ea", b: "#09090b", c: "#1d1d22", bar: "#09090b" },
    { id: "sage", name: "Sage", a: "#8fb79b", b: "#0f1512", c: "#22302a", bar: "#0f1512" },
    { id: "sand", name: "Sand", a: "#a0623a", b: "#f5efe6", c: "#fffaf3", bar: "#f5efe6" },
    { id: "ocean", name: "Ocean", a: "#6aa8e8", b: "#08111c", c: "#16263a", bar: "#08111c" },
  ];

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const byTime = (a, b) => (a.time || "").localeCompare(b.time || "");
  const isMobile = () => matchMedia("(max-width: 720px)").matches;
  const haptic = () => { try { navigator.vibrate?.(8); } catch {} };
  const fmtDur = (min) => { min = +min || 0; if (!min) return ""; if (min < 60) return `${min} min`; return `${(min / 60).toLocaleString(LOCALE)} h`; };
  const fmtDate = (d, o) => d.toLocaleDateString(LOCALE, o);
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
    if (s < 86400) return Math.round(s / 3600) + "h";
    if (s < 86400 * 30) return Math.round(s / 86400) + "d";
    return Math.round(s / 86400 / 30) + "mo";
  }
  function normUser(v) {
    return String(v || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "").replace(/^@/, "").split(/[/?#\s]/)[0];
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };

  /* ═════════════════════════ Config ═════════════════════════ */
  let cfg;
  // Items get a stable id; if one is missing we derive a deterministic one from its position
  const withIds = (map) => {
    const out = {};
    for (const k of Object.keys(map || {})) out[k] = (map[k] || []).map((x, i) => (x.id ? x : { ...x, id: `${k}-${i}` }));
    return out;
  };
  function loadConfig() {
    const o = db.get("cfg", null) || {};
    cfg = {
      name: o.name ?? BASE.name ?? "",
      github: { username: normUser(o.github?.username ?? BASE.github?.username ?? "") },
      spaces: clone(o.spaces ?? BASE.spaces ?? DEFAULT_SPACES),
      schedule: withIds(o.schedule ?? BASE.schedule ?? {}),
      lessons: withIds(o.lessons ?? BASE.lessons ?? {}),
      currency: o.currency ?? BASE.currency ?? "€",
    };
    if (!Array.isArray(cfg.spaces) || !cfg.spaces.length) cfg.spaces = clone(DEFAULT_SPACES);
  }
  function saveCfg(patch) {
    const { name, github, spaces, schedule, lessons, currency } = cfg;
    db.set("cfg", { name, github, spaces, schedule, lessons, currency, ...patch, v: CFG_VERSION });
    loadConfig();
  }
  loadConfig();

  // Upgrades for configs saved by older versions of the dashboard
  function migrateConfig() {
    const o = db.get("cfg", null);
    const v = o?.v ?? 1;
    if (!o || v >= CFG_VERSION) return;
    const spaces = (o.spaces || clone(DEFAULT_SPACES)).map((sp) => ({ ...sp, widgets: [...(sp.widgets || [])] }));
    if (v < 2 && !spaces.some((sp) => sp.id === "coach")) spaces.push(clone(DEFAULT_SPACES[2]));
    if (v < 3) for (const sp of spaces) {
      if ((sp.id === "coach" || sp.id === "sport") && !sp.widgets.includes("tournaments")) sp.widgets.splice(sp.id === "coach" ? 2 : 1, 0, "tournaments");
    }
    const schedule = withIds(o.schedule ?? BASE.schedule ?? {}), lessons = withIds(o.lessons ?? BASE.lessons ?? {});
    if (v < 4) {
      const RU = { "Работа": "Work", "Спорт": "Training", "Коучинг": "Coaching", "Личное": "Personal", "Главное": "Main" };
      for (const sp of spaces) if (RU[sp.name]) sp.name = RU[sp.name];
      // Marks used to point at a position in the time-sorted list; now they point at item ids
      const sorted = (map, k) => (map[DAY_KEYS[parseYmd(k).getDay()]] || []).slice().sort(byTime);
      for (const key of db.keys("done:")) {
        const vals = db.get(key, []);
        if (vals.some((x) => typeof x === "number")) {
          const list = sorted(schedule, key.slice(5));
          db.set(key, vals.map((x) => (typeof x === "number" ? list[x]?.id : x)).filter(Boolean));
        }
      }
      for (const key of db.keys("lesson:")) {
        const marks = db.get(key, {}), list = sorted(lessons, key.slice(7)), next = {};
        let changed = false;
        for (const [k, val] of Object.entries(marks)) {
          if (/^\d+$/.test(k)) { changed = true; if (list[+k]) next[list[+k].id] = val; } else next[k] = val;
        }
        if (changed) db.set(key, next);
      }
    }
    db.set("cfg", { ...o, spaces, schedule, lessons, v: CFG_VERSION });
    loadConfig();
  }

  /* ═════════════════════════ Data: training, lessons, tournaments ═════════════════════════ */
  const workoutsFor = (d) => (cfg.schedule[DAY_KEYS[d.getDay()]] || []).slice().sort(byTime);
  const isDone = (d, w) => db.get("done:" + ymd(d), []).includes(w.id);
  function toggleDone(d, w, ev) {
    const set = new Set(db.get("done:" + ymd(d), []));
    const on = !set.has(w.id);
    on ? set.add(w.id) : set.delete(w.id);
    db.set("done:" + ymd(d), [...set]);
    haptic();
    if (on && ev) burst(ev.clientX, ev.clientY);
    renderAll();
  }

  const lessonsFor = (d) => (cfg.lessons[DAY_KEYS[d.getDay()]] || []).slice().sort(byTime);
  const lessonMarks = (d) => db.get("lesson:" + ymd(d), {});
  function lessonEnd(d, l) {
    const [h, m] = (l.time || "23:59").split(":").map(Number);
    const x = new Date(d); x.setHours(h || 0, (m || 0) + (+l.duration || 60), 0, 0);
    return x;
  }
  // A past lesson counts as done automatically — only cancellations need marking
  const lessonStatus = (d, l) => lessonMarks(d)[l.id] || (Date.now() >= lessonEnd(d, l) ? "done" : "planned");
  function setLessonMark(d, l, val, ev) {
    const marks = { ...lessonMarks(d) };
    if (!val || marks[l.id] === val) delete marks[l.id]; else marks[l.id] = val;
    db.set("lesson:" + ymd(d), marks);
    haptic();
    if (val === "done" && marks[l.id] && ev) burst(ev.clientX, ev.clientY);
    renderAll();
  }

  const tournaments = () => db.get("tournaments", []).slice().sort((a, b) => a.from.localeCompare(b.from));
  const tourOn = (d) => { const k = ymd(d); return tournaments().filter((t) => t.from <= k && k <= (t.to || t.from)); };
  function tourRange(t) {
    const a = parseYmd(t.from), b = parseYmd(t.to || t.from);
    if (t.from === (t.to || t.from)) return fmtDate(a, { weekday: "short", day: "numeric", month: "short" });
    return `${fmtDate(a, { weekday: "short", day: "numeric" })} – ${fmtDate(b, { weekday: "short", day: "numeric", month: "short" })}`;
  }
  function tourWhen(t) {
    const days = Math.round((parseYmd(t.from) - parseYmd(ymd(new Date()))) / 864e5);
    if (days <= 0) return "on now";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }
  function tourConflicts(t) {
    const out = [];
    for (let d = parseYmd(t.from); d <= parseYmd(t.to || t.from); d = addDays(d, 1)) {
      lessonsFor(d).forEach((l) => { if (lessonStatus(d, l) !== "cancel") out.push({ d: new Date(d), l }); });
    }
    return out;
  }

  /* ═════════════════════════ Theme & motion ═════════════════════════ */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motionOn = () => store.get("motion", true) && !reduced.matches;
  const applyMotion = () => { document.documentElement.dataset.motion = motionOn() ? "on" : "off"; };
  function applyTheme(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    document.documentElement.dataset.theme = t.id;
    $('meta[name="theme-color"]')?.setAttribute("content", t.bar);
    store.set("theme", t.id);
    $$(".theme-card").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === t.id)));
  }

  /* ═════════════════════════ Effects ═════════════════════════ */
  function burst(x, y) {
    if (!motionOn()) return;
    const cs = getComputedStyle(document.documentElement);
    const colors = ["--accent-hi", "--gold", "--tennis", "--padel", "--ok"].map((v) => cs.getPropertyValue(v).trim());
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("i");
      s.className = "spark";
      s.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]}`;
      document.body.appendChild(s);
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4, r = 36 + Math.random() * 46;
      s.animate([
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.2)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => s.remove();
    }
  }

  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // Count-up numbers and progress rings animate from their previous value
  const animMem = new Map();
  function fmtNum(v, kind) {
    if (kind === "money") return `${Math.round(v).toLocaleString(LOCALE)} ${cfg.currency}`;
    if (kind === "hours") return (Math.round(v * 10) / 10).toLocaleString(LOCALE);
    return String(Math.round(v));
  }
  function animateIn(root) {
    const instant = !motionOn();
    $$("[data-count]", root).forEach((el) => {
      const key = el.dataset.key, to = +el.dataset.count, from = animMem.has(key) ? animMem.get(key) : 0;
      animMem.set(key, to);
      const put = (v) => { el.textContent = fmtNum(v, el.dataset.fmt); };
      if (instant || from === to) return put(to);
      put(from);
      const t0 = performance.now(), D = 900;
      const step = (now) => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); put(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    $$("[data-ring]", root).forEach((el) => {
      const key = el.dataset.ring, to = +el.dataset.to, from = animMem.has(key) ? animMem.get(key) : 0;
      animMem.set(key, to);
      if (instant || from === to) { el.style.setProperty("--p", to); return; }
      el.style.setProperty("--p", from);
      requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty("--p", to)));
    });
  }

  // 3D tilt with glare for cards and background parallax (mouse / trackpad only)
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  let tilted = null, tiltRaf = 0;
  function resetTilt(c) { if (!c) return; c.classList.remove("tilting"); c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); }
  document.addEventListener("pointermove", (e) => {
    if (!motionOn() || !finePointer.matches) return;
    const bg = $(".bg");
    bg.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
    bg.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
    const c = e.target.closest?.(".grid .card");
    if (c !== tilted) { resetTilt(tilted); tilted = c; }
    if (!c) return;
    cancelAnimationFrame(tiltRaf);
    tiltRaf = requestAnimationFrame(() => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const max = 6 * Math.min(1, 440 / r.width);
      c.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
      c.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
      c.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      c.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      c.classList.add("tilting");
    });
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { resetTilt(tilted); tilted = null; });

  /* ═════════════════════════ Header ═════════════════════════ */
  function greetingWord(h) {
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 23) return "Good evening";
    return "Good night";
  }
  let ghCount = null;
  function renderHeader() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
    $("#date").textContent = fmtDate(now, { weekday: "long", day: "numeric", month: "long" });
    $("#greeting").innerHTML = `${greetingWord(now.getHours())}${cfg.name ? `, <em>${esc(cfg.name)}</em>` : ""}`;

    const parts = [];
    const today = workoutsFor(now), left = today.filter((w) => !isDone(now, w));
    if (!today.length) parts.push("Rest day — recover well.");
    else if (!left.length) parts.push("Training done for today. Great work 💪");
    else parts.push(`Today: <b>${esc(left[0].title)}</b> at ${esc(left[0].time)}.`);

    const lessons = lessonsFor(now), next = lessons.find((l) => lessonStatus(now, l) === "planned");
    if (next) parts.push(`Next lesson: <b>${esc(next.time)} — ${esc(next.client)}</b> (${SPORTS[sportOf(next)][1].toLowerCase()}).`);
    else if (lessons.length) parts.push("All lessons done for today 🎾");

    const tToday = tourOn(now)[0];
    const tSoon = tournaments().find((t) => t.from > ymd(now) && parseYmd(t.from) - now < 7 * 864e5);
    if (tToday) parts.push(`🏆 Tournament today: <b>${esc(tToday.title)}</b>.`);
    else if (tSoon) parts.push(`🏆 <b>${esc(tSoon.title)}</b> ${tourWhen(tSoon)}.`);

    if (ghCount === 0) parts.push("GitHub inbox zero ✨");
    else if (ghCount != null) parts.push(`${plural(ghCount, "GitHub task", "GitHub tasks")} waiting.`);
    $("#subline").innerHTML = parts.join(" ");
  }

  function renderSyncStatus() {
    const dot = $("#syncDot"), line = $("#syncLine");
    const st = sync.enabled() ? sync.state : "off";
    dot.dataset.state = st;
    const when = sync.last ? new Date(sync.last).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : "—";
    const text = {
      off: token() ? "Sync is off" : "Add a GitHub token to sync your Mac and iPhone",
      syncing: "Syncing…",
      ok: `Synced at ${when}`,
      error: `Sync error: ${sync.message}`,
    }[st];
    dot.title = text;
    if (line) { line.textContent = text; line.dataset.state = st; }
  }
  sync.onStatus = renderSyncStatus;

  /* ═════════════════════════ Spaces ═════════════════════════ */
  let active = store.get("space", cfg.spaces[0].id);
  const currentSpace = () => cfg.spaces.find((s) => s.id === active) || cfg.spaces[0];
  const spaceIndex = () => cfg.spaces.indexOf(currentSpace());
  const indicator = document.createElement("span");
  indicator.className = "indicator";
  function renderSpaces() {
    const nav = $("#spaces");
    nav.style.setProperty("--n", cfg.spaces.length);
    const btns = cfg.spaces.map((s, i) => {
      const b = document.createElement("button");
      b.className = "space"; b.setAttribute("role", "tab"); b.dataset.id = s.id;
      b.setAttribute("aria-selected", String(s.id === currentSpace().id));
      b.innerHTML = `<span class="space-ico">${esc(s.icon || "•")}</span><span class="space-name">${esc(s.name)}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}`;
      return b;
    });
    nav.replaceChildren(indicator, ...btns);
    nav.onclick = (e) => { const b = e.target.closest(".space"); if (b) setSpace(b.dataset.id); };
    requestAnimationFrame(moveIndicator);
  }
  function moveIndicator() {
    const a = $('#spaces .space[aria-selected="true"]');
    if (!a) return;
    indicator.style.width = a.offsetWidth + "px";
    indicator.style.height = a.offsetHeight + "px";
    indicator.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    requestAnimationFrame(() => indicator.classList.add("ready"));
  }
  addEventListener("resize", () => requestAnimationFrame(moveIndicator));
  document.fonts?.ready.then(() => requestAnimationFrame(moveIndicator));
  function setSpace(id, dir = 0) {
    if (id === currentSpace().id) return;
    if (!dir) dir = cfg.spaces.findIndex((s) => s.id === id) > spaceIndex() ? 1 : -1;
    active = id; store.set("space", id); haptic();
    $$("#spaces .space").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
    moveIndicator();
    renderGrid(dir);
    if (isMobile()) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Swipe left / right between spaces on the phone
  (() => {
    let x0 = null, y0 = 0, ignore = false;
    const grid = $("#grid");
    grid.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      ignore = !!e.target.closest(".week, input, textarea, .gh-list");
      x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    grid.addEventListener("touchend", (e) => {
      if (x0 == null || ignore) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const i = spaceIndex() + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < cfg.spaces.length) setSpace(cfg.spaces[i].id, dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* ═════════════════════════ Widgets ═════════════════════════ */
  const WIDGETS = {
    today: { size: "", render: wToday },
    week: { size: "wide", render: wWeek },
    stats: { size: "", render: wStats },
    github: { size: "wide", render: wGithub },
    todo: { size: "", render: wTodo },
    focus: { size: "", render: wFocus },
    lessons: { size: "", render: wLessons },
    lessonsWeek: { size: "wide", render: wLessonsWeek },
    coachStats: { size: "", render: wCoachStats },
    tournaments: { size: "", render: wTournaments },
  };

  function card(title, size, body, extra = "") {
    const el = document.createElement("article");
    el.className = "card " + size;
    el.innerHTML = `<span class="glare" aria-hidden="true"></span><div class="card-head"><h3>${title}</h3><div class="head-actions">${extra}</div></div><div class="card-body">${body}</div>`;
    return el;
  }
  const addBtn = (attr, label) => `<button class="add-btn" ${attr} aria-label="${label}" title="${label}">${ICON.plus}</button>`;
  const count = (key, n, fmt = "") => `<span data-count="${n}" data-key="${key}" data-fmt="${fmt}">${fmtNum(n, fmt)}</span>`;

  function weekStrip(rows) {
    return `<div class="week">${rows.map((r) => `
      <div class="day ${r.today ? "is-today" : ""} ${r.tours.length ? "has-tour" : ""}" data-date="${r.key}">
        <div class="day-name"><span>${r.label}</span><span class="day-num">${r.num}</span></div>
        ${r.tours.map((t) => `<button class="pill t-tour" data-tour="${esc(t.id)}">🏆 ${esc(t.title)}<small>${ROLES[t.role] || ""}</small></button>`).join("")}
        ${r.items}
        ${!r.hasItems && !r.tours.length ? `<button class="rest" data-add-day="${r.day}"><span>${r.empty}</span><span class="rest-add">${ICON.plus}</span></button>` : ""}
      </div>`).join("")}</div>`;
  }
  function centerToday(el) {
    requestAnimationFrame(() => {
      const w = $(".week", el), t = $(".is-today", el);
      if (w && t && w.scrollWidth > w.clientWidth) w.scrollLeft = t.offsetLeft - (w.clientWidth - t.clientWidth) / 2;
    });
  }
  const weekRange = (mon) => `${mon.getDate()} – ${fmtDate(addDays(mon, 6), { day: "numeric", month: "short" })}`;

  /* ── Training ── */
  function wToday(size) {
    const now = new Date(), list = workoutsFor(now), day = DAY_KEYS[now.getDay()];
    const doneN = list.filter((w) => isDone(now, w)).length;
    const pct = list.length ? Math.round((doneN / list.length) * 100) : 100;
    const first = list[0];
    const body = list.length
      ? `<div class="today-main">
           <div class="ring" data-ring="t-${ymd(now)}" data-to="${pct}"><span>${TYPES[typeOf(first)][0]}</span></div>
           <div><div class="big-title">${esc(list.length === 1 ? first.title : plural(list.length, "session", "sessions"))}</div>
           <div class="wo-meta">${doneN} of ${list.length} done</div></div>
         </div>
         <ul class="rows">${list.map((w) => `
           <li class="row-item ${isDone(now, w) ? "done" : ""}">
             <button class="check ${isDone(now, w) ? "on" : ""}" data-done="${w.id}" aria-label="Mark “${esc(w.title)}” done">${ICON.check}</button>
             <span class="row-time">${esc(w.time || "")}</span>
             <button class="row-main" data-edit="${w.id}"><b>${esc(w.title)}</b><span class="wo-meta">${TYPES[typeOf(w)][0]} ${TYPES[typeOf(w)][1]}${w.duration ? " · " + fmtDur(w.duration) : ""}</span></button>
           </li>`).join("")}</ul>`
      : `<div class="today-main"><div class="ring" data-ring="t-rest" data-to="100"><span>☕</span></div>
           <div><div class="big-title">Rest day</div><div class="wo-meta">Sleep, walk, stretch</div></div></div>
         <button class="ghost wide-btn" data-add-day="${day}">${ICON.plus} Add training for today</button>`;
    const el = card("Today’s training", size, body, `<span class="chip accent">${DAY_SHORT[day]}</span>${addBtn(`data-add-day="${day}"`, "Add training")}`);
    el.onclick = (e) => {
      const d = e.target.closest("[data-done]"), ed = e.target.closest("[data-edit]"), add = e.target.closest("[data-add-day]");
      if (d) toggleDone(now, list.find((w) => w.id === d.dataset.done), e);
      if (ed) openWorkoutSheet({ item: list.find((w) => w.id === ed.dataset.edit), date: now });
      if (add) openWorkoutSheet({ day: add.dataset.addDay });
    };
    return el;
  }

  function wWeek(size) {
    const now = new Date(), mon = mondayOf(now);
    const rows = WEEK.map((k, idx) => {
      const d = addDays(mon, idx), list = workoutsFor(d);
      return {
        key: ymd(d), day: k, label: DAY_SHORT[k], num: d.getDate(), today: ymd(d) === ymd(now), tours: tourOn(d), hasItems: list.length, empty: "rest",
        items: list.map((w) => `<button class="pill t-${typeOf(w)} ${isDone(d, w) ? "done" : ""}" data-id="${w.id}">${esc(w.title)}<small>${esc(w.time || "")}${w.duration ? " · " + fmtDur(w.duration) : ""}</small></button>`).join(""),
      };
    });
    const el = card("Training this week", size, weekStrip(rows), `<span class="chip">${weekRange(mon)}</span>${addBtn('data-add-day=""', "Add training")}`);
    el.onclick = (e) => {
      const p = e.target.closest(".pill[data-id]"), t = e.target.closest("[data-tour]"), add = e.target.closest("[data-add-day]");
      if (p) { const d = parseYmd(p.closest(".day").dataset.date); openWorkoutSheet({ item: workoutsFor(d).find((w) => w.id === p.dataset.id), date: d }); }
      if (t) openTourSheet(tournaments().find((x) => x.id === t.dataset.tour));
      if (add) openWorkoutSheet({ day: add.dataset.addDay || DAY_KEYS[now.getDay()] });
    };
    centerToday(el);
    return el;
  }

  function wStats(size) {
    const now = new Date(), mon = mondayOf(now);
    let planned = 0, completed = 0;
    const bars = WEEK.map((k, idx) => {
      const d = addDays(mon, idx), list = workoutsFor(d), c = list.filter((w) => isDone(d, w)).length;
      planned += list.length; completed += c;
      return { k, h: list.length ? 22 + (c / list.length) * 78 : 6, on: c > 0, today: ymd(d) === ymd(now) };
    });
    // Streak: consecutive days where every planned session was done (rest days don't break it)
    let streak = 0;
    for (let i = 0, d = new Date(now); i < 365; i++, d = addDays(d, -1)) {
      const list = workoutsFor(d);
      if (!list.length) continue;
      if (list.every((w) => isDone(d, w))) streak++;
      else if (i === 0) continue;
      else break;
    }
    const month = db.keys("done:" + ymd(now).slice(0, 7)).reduce((s, k) => s + db.get(k, []).length, 0);
    const body = `<div class="stats">
        <div class="stat"><b>${count("s-c", completed)}<i>/</i>${count("s-p", planned)}</b><span>this week</span></div>
        <div class="stat"><b>${count("s-s", streak)}</b><span>day streak 🔥</span></div>
        <div class="stat"><b>${count("s-m", month)}</b><span>this month</span></div>
      </div>
      <div class="bars">${bars.map((b, i) => `<i class="${b.on ? "on" : ""} ${b.today ? "today" : ""}" style="--h:${b.h}%;--d:${i * 60}ms"></i>`).join("")}</div>
      <div class="bars-lbl">${bars.map((b) => `<span>${DAY_SHORT[b.k].slice(0, 2)}</span>`).join("")}</div>`;
    return card("Progress", size, body);
  }

  /* ── Coaching ── */
  function wLessons(size) {
    const now = new Date(), list = lessonsFor(now), day = DAY_KEYS[now.getDay()];
    const rows = list.map((l) => ({ l, st: lessonStatus(now, l) }));
    const live = rows.filter((r) => r.st !== "cancel");
    const totalMin = live.reduce((s, r) => s + (+r.l.duration || 0), 0);
    const body = list.length
      ? `<ul class="rows">${rows.map(({ l, st }) => {
          const [ico, label] = SPORTS[sportOf(l)];
          return `<li class="row-item lesson s-${st}">
            <span class="row-time">${esc(l.time || "")}</span>
            <button class="row-main" data-edit="${l.id}"><b>${esc(l.client)}</b>
              <span class="wo-meta"><span class="sport ${sportOf(l)}">${ico} ${label}</span>${l.duration ? " · " + fmtDur(l.duration) : ""}${l.place ? " · " + esc(l.place) : ""}${+l.price ? " · " + fmtNum(l.price, "money") : ""}</span></button>
            <span class="row-act">
              <button class="check ${st === "done" ? "on" : ""}" data-mark="done" data-id="${l.id}" title="Done" aria-label="Done">${ICON.check}</button>
              <button class="check cancel ${st === "cancel" ? "on" : ""}" data-mark="cancel" data-id="${l.id}" title="Cancelled" aria-label="Cancelled">${ICON.x}</button>
            </span></li>`;
        }).join("")}</ul>`
      : `<div class="today-main"><div class="ring" data-ring="l-free" data-to="100"><span>🌴</span></div>
           <div><div class="big-title">No lessons today</div><div class="wo-meta">Time for your own game — or rest</div></div></div>
         <button class="ghost wide-btn" data-add-day="${day}">${ICON.plus} Add a lesson</button>`;
    const chip = list.length ? `<span class="chip accent">${plural(live.length, "lesson", "lessons")} · ${fmtDur(totalMin) || "0 h"}</span>` : "";
    const el = card("Today’s lessons", size, body, chip + addBtn(`data-add-day="${day}"`, "Add lesson"));
    el.onclick = (e) => {
      const m = e.target.closest("[data-mark]"), ed = e.target.closest("[data-edit]"), add = e.target.closest("[data-add-day]");
      if (m) setLessonMark(now, list.find((l) => l.id === m.dataset.id), m.dataset.mark, e);
      if (ed) openLessonSheet({ item: list.find((l) => l.id === ed.dataset.edit), date: now });
      if (add) openLessonSheet({ day: add.dataset.addDay });
    };
    return el;
  }

  function wLessonsWeek(size) {
    const now = new Date(), mon = mondayOf(now);
    const rows = WEEK.map((k, idx) => {
      const d = addDays(mon, idx), list = lessonsFor(d);
      return {
        key: ymd(d), day: k, label: DAY_SHORT[k], num: d.getDate(), today: ymd(d) === ymd(now), tours: tourOn(d), hasItems: list.length, empty: "free",
        items: list.map((l) => {
          const st = lessonStatus(d, l);
          return `<button class="pill t-${sportOf(l)} ${st === "cancel" ? "cancelled" : st === "done" ? "past" : ""}" data-id="${l.id}">${SPORTS[sportOf(l)][0]} ${esc(l.client)}<small>${esc(l.time || "")}${l.duration ? " · " + fmtDur(l.duration) : ""}</small></button>`;
        }).join(""),
      };
    });
    const el = card("Lessons this week", size, weekStrip(rows), `<span class="chip">${weekRange(mon)}</span>${addBtn('data-add-day=""', "Add lesson")}`);
    el.onclick = (e) => {
      const p = e.target.closest(".pill[data-id]"), t = e.target.closest("[data-tour]"), add = e.target.closest("[data-add-day]");
      if (p) { const d = parseYmd(p.closest(".day").dataset.date); openLessonSheet({ item: lessonsFor(d).find((l) => l.id === p.dataset.id), date: d }); }
      if (t) openTourSheet(tournaments().find((x) => x.id === t.dataset.tour));
      if (add) openLessonSheet({ day: add.dataset.addDay || DAY_KEYS[now.getDay()] });
    };
    centerToday(el);
    return el;
  }

  function wCoachStats(size) {
    const now = new Date(), mon = mondayOf(now);
    const sum = (from, to) => {
      const r = { done: 0, planned: 0, min: 0, earned: 0, forecast: 0, tennis: 0, padel: 0 };
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        for (const l of lessonsFor(d)) {
          const st = lessonStatus(d, l);
          if (st === "cancel") continue;
          r.planned++; r.forecast += +l.price || 0;
          if (st === "done") { r.done++; r.min += +l.duration || 0; r.earned += +l.price || 0; r[sportOf(l)]++; }
        }
      }
      return r;
    };
    const week = sum(mon, addDays(mon, 6));
    const month = sum(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const both = month.tennis + month.padel, tp = both ? Math.round((month.tennis / both) * 100) : 50;
    const body = `<div class="stats">
        <div class="stat"><b>${count("c-d", week.done)}<i>/</i>${count("c-p", week.planned)}</b><span>lessons this week</span></div>
        <div class="stat"><b>${count("c-h", week.min / 60, "hours")}</b><span>hours on court</span></div>
        <div class="stat"><b>${count("c-m", month.done)}</b><span>this month</span></div>
      </div>
      <div class="earn">
        <div><span class="muted">Earned this month</span><b>${count("c-e", month.earned, "money")}</b></div>
        <div class="right"><span class="muted">Forecast</span><b class="soft">${count("c-f", month.forecast, "money")}</b></div>
      </div>
      <div class="split" style="--tp:${tp}%"><i></i></div>
      <div class="split-lbl"><span>🎾 Tennis · ${month.tennis}</span><span>${month.padel} · Padel 🏓</span></div>`;
    return card("Coaching stats", size, body);
  }

  /* ── Tournaments ── */
  function wTournaments(size) {
    const todayK = ymd(new Date());
    const upcoming = tournaments().filter((t) => (t.to || t.from) >= todayK);
    const past = tournaments().length - upcoming.length;
    const list = upcoming.map((t) => {
      const conf = tourConflicts(t);
      return `<li class="tour t-${t.sport === "padel" ? "padel" : "tennis"}">
        <button class="tour-main" data-tour="${esc(t.id)}">
          <span class="tour-head"><span class="tour-date">${tourRange(t)}</span><span class="chip ${t.from <= todayK ? "accent" : ""}">${tourWhen(t)}</span></span>
          <b>🏆 ${esc(t.title)}</b>
          <span class="wo-meta">${SPORTS[t.sport]?.[0] || "🎾"} ${SPORTS[t.sport]?.[1] || ""} · ${ROLES[t.role] || ""}${t.place ? " · " + esc(t.place) : ""}</span>
        </button>
        ${conf.length ? `<div class="tour-warn">⚠️ ${plural(conf.length, "lesson", "lessons")} on these days: ${conf.map((c) => esc(c.l.client)).join(", ")}
            <button class="link" data-cancel-lessons="${esc(t.id)}">Cancel them</button></div>` : ""}
      </li>`;
    }).join("");
    const body = upcoming.length
      ? `<ul class="tours">${list}</ul>`
      : `<button class="empty-state" data-add-tour>${ICON.plus}<span>No tournaments planned.<br>Add the next one — it shows up in your week and greeting.</span></button>`;
    const el = card("Tournaments", size, body + (past ? `<p class="hint">${plural(past, "past tournament", "past tournaments")}</p>` : ""), addBtn("data-add-tour", "Add tournament"));
    el.onclick = (e) => {
      const add = e.target.closest("[data-add-tour]"), t = e.target.closest("[data-tour]"), cl = e.target.closest("[data-cancel-lessons]");
      if (add) openTourSheet();
      if (t) openTourSheet(tournaments().find((x) => x.id === t.dataset.tour));
      if (cl) {
        const tr = tournaments().find((x) => x.id === cl.dataset.cancelLessons);
        for (const c of tourConflicts(tr)) db.set("lesson:" + ymd(c.d), { ...lessonMarks(c.d), [c.l.id]: "cancel" });
        haptic(); toast("Lessons cancelled"); renderAll();
      }
    };
    return el;
  }

  /* ── GitHub ── */
  const GH_TABS = [
    // GitHub search requires is:issue or is:pr in every query, so "Assigned" is two queries
    { id: "assigned", label: "Assigned", q: (u) => [`is:open is:issue assignee:${u} archived:false`, `is:open is:pr assignee:${u} archived:false`] },
    { id: "review", label: "Review", q: (u) => [`is:open is:pr review-requested:${u} archived:false`] },
    { id: "mine", label: "My PRs", q: (u) => [`is:open is:pr author:${u} archived:false`] },
  ];
  const ghCache = new Map();
  let ghTab = store.get("ghTab", "assigned");
  async function ghFetch(query) {
    const hit = ghCache.get(query);
    if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.data;
    const headers = { Accept: "application/vnd.github+json" };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const r = await fetch(`https://api.github.com/search/issues?per_page=30&sort=updated&q=${encodeURIComponent(query)}`, { headers });
    if (!r.ok) {
      let msg = "", detail = "";
      try { const b = await r.json(); msg = b.message || ""; detail = (b.errors || []).map((e) => e.message).join(" ") || msg; } catch {}
      if (r.status === 401) throw new Error("The token was rejected — check it’s copied in full and hasn’t expired");
      if (r.status === 403) throw new Error("GitHub rate limit reached — add a token");
      if (r.status === 422 && !/validation failed/i.test(msg)) throw new Error("GitHub: " + (detail || msg));
      if (r.status === 422) {
        const repos = (query.match(/repo:\S+/g) || []).map((x) => x.slice(5));
        throw new Error(`GitHub couldn’t find user “${cfg.github.username}”${repos.length ? ` or repositories ${repos.join(", ")}` : ""}. Check the username (not your display name or email)`);
      }
      throw new Error(`GitHub ${r.status}${detail ? ": " + detail : ""}`);
    }
    const data = await r.json();
    ghCache.set(query, { t: Date.now(), data });
    return data;
  }
  function wGithub(size) {
    const space = currentSpace();
    const tabs = `<div class="seg gh-tabs">${GH_TABS.map((t) => `<button data-t="${t.id}" class="${t.id === ghTab ? "on" : ""}">${t.label}</button>`).join("")}</div>`;
    const el = card("GitHub", size, `<ul class="gh-list">${'<li class="skeleton"></li>'.repeat(3)}</ul>`, tabs);
    const list = $(".gh-list", el);
    $(".gh-tabs", el).onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      ghTab = b.dataset.t; store.set("ghTab", ghTab); haptic();
      const n = wGithub(size); n.classList.add("no-enter"); el.replaceWith(n);
    };
    const user = cfg.github.username;
    if (!user) { list.innerHTML = `<li class="empty">Set your GitHub username in <a href="#" data-settings="github">Settings</a>.</li>`; return el; }
    const repos = (space.repos || []).map((r) => ` repo:${r}`).join("");
    const tab = GH_TABS.find((t) => t.id === ghTab) || GH_TABS[0];
    Promise.all(tab.q(user).map((q) => ghFetch(q + repos))).then((parts) => {
      const total = parts.reduce((n, p) => n + p.total_count, 0);
      const items = parts.flatMap((p) => p.items).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30);
      if (tab.id === "assigned") { ghCount = total; renderHeader(); }
      if (!items.length) { list.innerHTML = `<li class="empty">Nothing here — enjoy the calm ✨</li>`; return; }
      list.innerHTML = items.map((it, i) => {
        const repo = it.repository_url.split("/repos/")[1], pr = !!it.pull_request;
        return `<li class="gh-item" style="--d:${i * 40}ms"><a href="${esc(it.html_url)}" target="_blank" rel="noopener">
          <span class="gh-ico ${pr ? "pr" : ""}">${pr ? "⇄" : "◉"}</span>
          <span><span class="gh-title">${esc(it.title)}</span>
            <span class="gh-repo">${esc(repo)} #${it.number}</span>
            ${it.labels.length ? `<span class="gh-labels">${it.labels.slice(0, 4).map((l) => `<span class="gh-label" style="--lc:#${esc(l.color)}">${esc(l.name)}</span>`).join("")}</span>` : ""}
          </span>
          <span class="gh-age">${ago(it.updated_at)}</span></a></li>`;
      }).join("");
    }).catch((err) => {
      list.innerHTML = `<li class="empty">${esc(err.message)}. <a href="#" data-settings="github">Settings</a></li>`;
    });
    return el;
  }

  /* ── Tasks (per space, synced) ── */
  function wTodo(size) {
    const sid = currentSpace().id, key = "todo:" + sid;
    const items = db.get(key, []).slice();
    const left = items.filter((t) => !t.done).length;
    const body = `<form class="todo-add"><input placeholder="Add a task…" maxlength="200" enterkeyhint="done" aria-label="New task" /><button class="add-btn solid" type="submit" aria-label="Add">${ICON.plus}</button></form>
      <ul class="todo-list">${items.length ? items.map((t, i) => `
        <li class="todo ${t.done ? "done" : ""}"><button class="check ${t.done ? "on" : ""}" data-i="${i}" aria-label="Done">${ICON.check}</button>
        <span>${esc(t.text)}</span><button class="del" data-del="${i}" title="Delete" aria-label="Delete">${ICON.x}</button></li>`).join("")
        : `<li class="empty">Your tasks for “${esc(currentSpace().name)}” will live here</li>`}</ul>`;
    const el = card("Tasks", size, body, `<span class="chip">${left} left</span>`);
    const save = (next, refocus) => {
      db.set(key, next);
      const fresh = wTodo(size); fresh.classList.add("no-enter");
      el.replaceWith(fresh); animateIn(fresh);
      if (refocus) $("input", fresh).focus();
    };
    $("form", el).onsubmit = (e) => {
      e.preventDefault();
      const v = $("input", el).value.trim();
      if (v) { haptic(); save([{ text: v, done: false }, ...items], true); }
    };
    el.addEventListener("click", (e) => {
      const c = e.target.closest(".check"), d = e.target.closest("[data-del]");
      if (c) {
        const i = +c.dataset.i; haptic();
        if (!items[i].done) burst(e.clientX, e.clientY);
        items[i] = { ...items[i], done: !items[i].done };
        save(items.sort((a, b) => a.done - b.done));
      }
      if (d) { items.splice(+d.dataset.del, 1); save(items); }
    });
    return el;
  }

  /* ── Focus timer (counts down to an end time, so it stays right when the iPhone sleeps) ── */
  const focus = { mode: "work", left: 25 * 60, endAt: 0, timer: null };
  const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const focusTotal = () => (focus.mode === "work" ? 25 : 5) * 60;
  function focusTick() {
    if (!focus.endAt) return;
    focus.left = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
    if (focus.left <= 0) {
      clearInterval(focus.timer); focus.endAt = 0;
      try { new Notification(focus.mode === "work" ? "Break time ☕" : "Back to focus 🎯"); } catch {}
      try { navigator.vibrate?.([120, 80, 120]); } catch {}
      focus.mode = focus.mode === "work" ? "break" : "work";
      focus.left = focusTotal();
      renderGrid();
      return;
    }
    const live = $(".focus-time");
    if (live) live.textContent = fmtClock(focus.left);
    $(".focus-ring")?.style.setProperty("--p", 100 - (focus.left / focusTotal()) * 100);
  }
  function wFocus(size) {
    const running = !!focus.endAt;
    const body = `<div class="focus-ring ring big" style="--p:${100 - (focus.left / focusTotal()) * 100}"><span class="focus-time">${fmtClock(focus.left)}</span></div>
      <div class="focus-btns">
        <button class="primary" data-a="toggle">${running ? "Pause" : "Start"}</button>
        <div class="seg"><button data-a="work" class="${focus.mode === "work" ? "on" : ""}">25 min</button><button data-a="break" class="${focus.mode === "break" ? "on" : ""}">5 min</button></div>
      </div>`;
    const el = card("Focus", size, body, `<span class="chip ${focus.mode === "work" ? "accent" : ""}">${focus.mode === "work" ? "deep work" : "break"}</span>`);
    el.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      haptic(); clearInterval(focus.timer);
      if (a === "toggle" && !running) {
        focus.endAt = Date.now() + focus.left * 1000;
        focus.timer = setInterval(focusTick, 500);
        try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch {}
      } else if (a === "toggle") { focusTick(); focus.endAt = 0; }
      else { focus.mode = a; focus.left = focusTotal(); focus.endAt = 0; }
      const n = wFocus(size); n.classList.add("no-enter"); el.replaceWith(n);
    };
    return el;
  }

  /* ═════════════════════════ Grid ═════════════════════════ */
  function renderGrid(dir = 0) {
    const grid = $("#grid");
    grid.dataset.dir = dir > 0 ? "next" : dir < 0 ? "prev" : "";
    const cards = (currentSpace().widgets || []).map((id, i) => {
      const w = WIDGETS[id]; if (!w) return null;
      const el = w.render(w.size);
      el.style.setProperty("--i", i);
      return el;
    }).filter(Boolean);
    // Cards fly in only on first paint and when switching spaces
    if (!dir && grid.dataset.ready) cards.forEach((c) => c.classList.add("no-enter"));
    grid.replaceChildren(...cards);
    grid.dataset.ready = "1";
    tilted = null;
    animateIn(grid);
  }
  function renderAll() { renderHeader(); renderGrid(); }

  db.onRemoteChange(() => {
    const busy = document.activeElement?.matches("input, textarea") || $("#itemSheet").open;
    loadConfig(); migrateConfig();
    renderSpaces(); renderHeader();
    if (!busy) renderGrid();
  });

  /* ═════════════════════════ Item sheets: add / edit right on the page ═════════════════════════ */
  const itemDlg = $("#itemSheet"), itemForm = $("#itemForm");
  let itemSubmit = null, itemAction = null;

  const chips = (name, options, selected, multi = false) =>
    `<div class="chips" data-name="${name}" data-multi="${multi ? 1 : 0}" role="${multi ? "group" : "radiogroup"}">${options.map(([v, label]) =>
      `<button type="button" class="chip-btn" data-value="${esc(v)}" aria-pressed="${selected.map(String).includes(String(v))}">${label}</button>`).join("")}</div>`;
  const readChips = (name) => $$(`.chips[data-name="${name}"] .chip-btn[aria-pressed="true"]`, itemForm).map((b) => b.dataset.value);
  const durOptions = (opts, cur) => { cur = +cur; const all = cur && !opts.includes(cur) ? [...opts, cur].sort((a, b) => a - b) : opts; return all.map((m) => [m, fmtDur(m)]); };
  const findDay = (map, id) => Object.keys(map).find((k) => (map[k] || []).some((x) => x.id === id));
  const removeById = (map, id) => { for (const k of Object.keys(map)) map[k] = (map[k] || []).filter((x) => x.id !== id); };

  itemForm.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-btn");
    if (chip) {
      const group = chip.closest(".chips");
      if (group.dataset.multi === "1") chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
      else $$(".chip-btn", group).forEach((b) => b.setAttribute("aria-pressed", String(b === chip)));
      haptic();
      return;
    }
    const act = e.target.closest("[data-act]");
    if (act && itemAction) itemAction(act.dataset.act, act, e);
  });
  itemForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    e.preventDefault();
    const err = itemSubmit?.();
    if (err) { $("#itemErr").textContent = err; return; }
    itemDlg.close();
  });
  itemDlg.addEventListener("click", (e) => { if (e.target === itemDlg) itemDlg.close(); });

  function openSheet(html, onSubmit, onAction) {
    itemForm.innerHTML = html;
    itemSubmit = onSubmit; itemAction = onAction;
    itemDlg.showModal();
    if (!isMobile()) $("input:not([type=time]):not([type=date])", itemForm)?.focus();
  }
  const sheetHead = (title, sub = "") => `<header class="item-head"><div><h3>${title}</h3>${sub ? `<p class="muted">${sub}</p>` : ""}</div>
    <button class="icon-btn" value="cancel" formnovalidate aria-label="Close">${ICON.x}</button></header>`;
  const sheetFoot = (editing, label) => `<p class="err" id="itemErr"></p><footer class="item-foot">
    ${editing ? `<button type="button" class="ghost danger" data-act="delete">Delete</button>` : "<span></span>"}
    <button class="primary" value="save">${label}</button></footer>`;
  const occDate = (d) => fmtDate(d, { weekday: "long", day: "numeric", month: "long" });

  function openWorkoutSheet({ item, date, day }) {
    const editing = !!item;
    const w = item || { time: "07:30", title: "", duration: 60, type: "gym" };
    const dayOf = editing ? findDay(cfg.schedule, item.id) : day || DAY_KEYS[new Date().getDay()];
    const done = editing && date ? isDone(date, item) : false;
    const occ = editing && date ? `<div class="occ"><div><b>${occDate(date)}</b><span class="muted">this session</span></div>
        <button type="button" class="${done ? "primary" : "btn"}" data-act="done">${done ? `${ICON.check} Done` : "Mark as done"}</button></div>` : "";
    openSheet(`${sheetHead(editing ? "Edit training" : "New training", editing ? "Changes apply to every week" : "Repeats every week on the days you pick")}${occ}
      <label>Title<input name="title" required maxlength="80" placeholder="e.g. Gym — upper body" value="${esc(w.title)}" /></label>
      <div class="field"><span>Type</span>${chips("type", Object.entries(TYPES).map(([id, [ico, l]]) => [id, `${ico} ${l}`]), [typeOf(w)])}</div>
      <div class="field"><span>${editing ? "Day" : "Repeat on"}</span>${chips("days", WEEK.map((k) => [k, DAY_SHORT[k]]), [dayOf], !editing)}</div>
      <div class="row2">
        <label>Time<input type="time" name="time" step="1800" value="${esc(w.time)}" required /></label>
        <div class="field"><span>Duration</span>${chips("duration", durOptions([30, 60, 90, 120], w.duration), [w.duration || 60])}</div>
      </div>
      ${sheetFoot(editing, editing ? "Save" : "Add training")}`,
    () => {
      const title = itemForm.title.value.trim(), days = readChips("days");
      if (!title) return "Give it a title";
      if (!days.length) return "Pick at least one day";
      const data = { time: itemForm.time.value, title, type: readChips("type")[0] || "gym", duration: +readChips("duration")[0] || 60 };
      const schedule = clone(cfg.schedule);
      if (editing) { removeById(schedule, item.id); (schedule[days[0]] ||= []).push({ ...data, id: item.id }); }
      else for (const k of days) (schedule[k] ||= []).push({ ...data, id: uid() });
      saveCfg({ schedule }); renderAll();
      toast(editing ? "Training updated" : days.length > 1 ? `Added on ${days.length} days` : "Training added");
    },
    (act, btn, e) => {
      if (act === "done") { toggleDone(date, item, e); itemDlg.close(); }
      if (act === "delete" && confirm(`Delete “${item.title}” from every ${DAY_SHORT[dayOf]}?`)) {
        const schedule = clone(cfg.schedule); removeById(schedule, item.id);
        saveCfg({ schedule }); itemDlg.close(); renderAll(); toast("Training deleted");
      }
    });
  }

  function openLessonSheet({ item, date, day }) {
    const editing = !!item;
    const prev = Object.values(cfg.lessons).flat().at(-1);
    const l = item || { time: "10:00", client: "", sport: prev?.sport || "padel", duration: 60, place: prev?.place || "", price: prev?.price || "" };
    const dayOf = editing ? findDay(cfg.lessons, item.id) : day || DAY_KEYS[new Date().getDay()];
    let occ = "";
    if (editing && date) {
      const mark = lessonMarks(date)[item.id] || "", st = lessonStatus(date, item);
      occ = `<div class="occ"><div><b>${occDate(date)}</b><span class="muted">${st === "cancel" ? "cancelled" : st === "done" ? "done" : "scheduled"}${!mark && st === "done" ? " (auto)" : ""}</span></div>
        <div class="seg"><button type="button" data-act="status" data-v="" class="${!mark ? "on" : ""}">Auto</button><button type="button" data-act="status" data-v="done" class="${mark === "done" ? "on" : ""}">Done</button><button type="button" data-act="status" data-v="cancel" class="${mark === "cancel" ? "on" : ""}">Cancelled</button></div></div>`;
    }
    openSheet(`${sheetHead(editing ? "Edit lesson" : "New lesson", editing ? "Changes apply to every week" : "A weekly lesson with a player or group")}${occ}
      <label>Player or group<input name="client" required maxlength="80" placeholder="e.g. Anna, Kids group" value="${esc(l.client)}" /></label>
      <div class="row2">
        <div class="field"><span>Sport</span>${chips("sport", Object.entries(SPORTS).map(([id, [ico, lb]]) => [id, `${ico} ${lb}`]), [sportOf(l)])}</div>
        <div class="field"><span>Duration</span>${chips("duration", durOptions([60, 90, 120], l.duration), [l.duration || 60])}</div>
      </div>
      <div class="field"><span>${editing ? "Day" : "Repeat on"}</span>${chips("days", WEEK.map((k) => [k, DAY_SHORT[k]]), [dayOf], !editing)}</div>
      <div class="row3">
        <label>Time<input type="time" name="time" step="1800" value="${esc(l.time)}" required /></label>
        <label>Court / club<input name="place" maxlength="60" placeholder="Court 2" value="${esc(l.place || "")}" /></label>
        <label>Price, ${esc(cfg.currency)}<input type="number" name="price" min="0" inputmode="decimal" placeholder="0" value="${esc(l.price || "")}" /></label>
      </div>
      ${sheetFoot(editing, editing ? "Save" : "Add lesson")}`,
    () => {
      const client = itemForm.client.value.trim(), days = readChips("days");
      if (!client) return "Who is the lesson with?";
      if (!days.length) return "Pick at least one day";
      const data = { time: itemForm.time.value, client, sport: readChips("sport")[0] || "tennis", duration: +readChips("duration")[0] || 60,
        place: itemForm.place.value.trim(), price: +itemForm.price.value || 0 };
      const lessons = clone(cfg.lessons);
      if (editing) { removeById(lessons, item.id); (lessons[days[0]] ||= []).push({ ...data, id: item.id }); }
      else for (const k of days) (lessons[k] ||= []).push({ ...data, id: uid() });
      saveCfg({ lessons }); renderAll();
      toast(editing ? "Lesson updated" : days.length > 1 ? `Added on ${days.length} days` : "Lesson added");
    },
    (act, btn, e) => {
      if (act === "status") { setLessonMark(date, item, btn.dataset.v || null, e); itemDlg.close(); }
      if (act === "delete" && confirm(`Delete the lesson with ${item.client} from every ${DAY_SHORT[dayOf]}?`)) {
        const lessons = clone(cfg.lessons); removeById(lessons, item.id);
        saveCfg({ lessons }); itemDlg.close(); renderAll(); toast("Lesson deleted");
      }
    });
  }

  function openTourSheet(t) {
    const editing = !!t;
    const sat = (() => { const d = new Date(); return addDays(d, (6 - d.getDay() + 7) % 7 || 7); })();
    const x = t || { title: "", from: ymd(sat), to: ymd(addDays(sat, 1)), sport: "padel", role: "play", place: "" };
    openSheet(`${sheetHead(editing ? "Edit tournament" : "New tournament", "Shows up in your weeks and greeting")}
      <label>Name<input name="title" required maxlength="80" placeholder="e.g. Padel Open" value="${esc(x.title)}" /></label>
      <div class="row2">
        <label>From<input type="date" name="from" value="${esc(x.from)}" required /></label>
        <label>To<input type="date" name="to" value="${esc(x.to || x.from)}" /></label>
      </div>
      <div class="row2">
        <div class="field"><span>Sport</span>${chips("sport", Object.entries(SPORTS).map(([id, [ico, lb]]) => [id, `${ico} ${lb}`]), [x.sport])}</div>
        <div class="field"><span>I’m…</span>${chips("role", Object.entries(ROLES), [x.role])}</div>
      </div>
      <label>Club / city<input name="place" maxlength="80" placeholder="optional" value="${esc(x.place || "")}" /></label>
      ${sheetFoot(editing, editing ? "Save" : "Add tournament")}`,
    () => {
      const title = itemForm.title.value.trim(), from = itemForm.from.value;
      if (!title || !from) return "Name and start date are required";
      const to = itemForm.to.value && itemForm.to.value >= from ? itemForm.to.value : from;
      const next = { id: t?.id || uid(), title, from, to, sport: readChips("sport")[0] || "padel", role: readChips("role")[0] || "play", place: itemForm.place.value.trim() };
      db.set("tournaments", [...db.get("tournaments", []).filter((y) => y.id !== next.id), next]);
      renderAll();
      const c = tourConflicts(next).length;
      toast(c ? `Saved · ${c === 1 ? "1 lesson clashes" : `${c} lessons clash`} with it` : editing ? "Tournament updated" : "Tournament added");
    },
    (act) => {
      if (act === "delete" && confirm(`Delete “${t.title}”?`)) {
        db.set("tournaments", db.get("tournaments", []).filter((y) => y.id !== t.id));
        itemDlg.close(); renderAll(); toast("Tournament deleted");
      }
    });
    itemForm.from.addEventListener("change", () => { if (!itemForm.to.value || itemForm.to.value < itemForm.from.value) itemForm.to.value = itemForm.from.value; });
  }

  /* ═════════════════════════ Settings (sidebar sections) ═════════════════════════ */
  const sDlg = $("#settings"), sForm = $("#settingsForm");
  const SECTIONS = { profile: "Profile", appearance: "Appearance", github: "GitHub", sync: "Sync", coaching: "Coaching", spaces: "Spaces", account: "Account" };
  function showSection(id) {
    if (!SECTIONS[id]) id = "profile";
    $$("#settingsNav button").forEach((b) => b.classList.toggle("on", b.dataset.sec === id));
    $$(".settings-body > section").forEach((s) => { s.hidden = s.dataset.sec !== id; });
    $("#secTitle").textContent = SECTIONS[id];
    store.set("settingsSec", id);
    $("#settingsNav button.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }
  $("#settingsNav").addEventListener("click", (e) => { const b = e.target.closest("button[data-sec]"); if (b) { showSection(b.dataset.sec); haptic(); } });
  function renderThemeGrid() {
    const cur = document.documentElement.dataset.theme;
    $("#themeGrid").innerHTML = THEMES.map((t) => `<button type="button" class="theme-card" data-id="${t.id}" aria-pressed="${cur === t.id}" style="--ta:${t.a};--tb:${t.b};--tc:${t.c}">
      <span class="tc-preview"><i></i><i></i><i></i></span><span class="tc-name">${t.name}</span></button>`).join("");
  }
  $("#themeGrid").addEventListener("click", (e) => { const b = e.target.closest(".theme-card"); if (b) { applyTheme(b.dataset.id); haptic(); } });
  sForm.motion.addEventListener("change", () => { store.set("motion", sForm.motion.checked); applyMotion(); });

  function openSettings(sec) {
    sForm.name.value = cfg.name;
    sForm.ghUser.value = cfg.github.username || "";
    sForm.ghToken.value = store.get("token", "");
    sForm.syncOn.checked = store.get("syncOn", true);
    sForm.currency.value = cfg.currency;
    sForm.spaces.value = JSON.stringify(cfg.spaces, null, 2);
    sForm.motion.checked = store.get("motion", true);
    $("#motionNote").hidden = !reduced.matches;
    $("#ownerLine").textContent = store.get("owner", "") ? `Signed in with the token of @${store.get("owner", "")}` : "Signed in with a GitHub token";
    renderThemeGrid(); renderSyncStatus();
    $("#settingsErr").textContent = "";
    showSection(typeof sec === "string" ? sec : isMobile() ? "profile" : store.get("settingsSec", "profile"));
    sDlg.showModal();
  }
  sForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    try {
      const spaces = JSON.parse(sForm.spaces.value);
      if (!Array.isArray(spaces) || !spaces.length) throw new Error("keep at least one space");
      const next = { name: sForm.name.value.trim(), github: { username: normUser(sForm.ghUser.value) }, spaces, currency: sForm.currency.value.trim() || "€" };
      const same = ["name", "github", "spaces", "currency"].every((k) => JSON.stringify(next[k]) === JSON.stringify(cfg[k]));
      if (!same) saveCfg(next);
      const tok = sForm.ghToken.value.trim();
      if (tok !== store.get("token", "")) { store.set("token", tok); sync.reset(); }
      store.set("syncOn", sForm.syncOn.checked);
      ghCache.clear(); ghCount = null;
      renderSpaces(); renderAll();
      sync.schedule(0); renderSyncStatus();
      toast("Settings saved");
    } catch (err) { e.preventDefault(); $("#settingsErr").textContent = "Error: " + err.message; showSection("spaces"); }
  });
  $("#syncNow").onclick = () => {
    if (sForm.ghToken.value.trim() !== store.get("token", "")) { store.set("token", sForm.ghToken.value.trim()); sync.reset(); }
    store.set("syncOn", true); sForm.syncOn.checked = true;
    sync.run();
  };
  $("#resetSpaces").onclick = () => {
    if (!confirm("Reset spaces to the default layout? Your training, lessons and tasks stay.")) return;
    saveCfg({ spaces: clone(DEFAULT_SPACES) }); sForm.spaces.value = JSON.stringify(cfg.spaces, null, 2);
    renderSpaces(); renderAll(); toast("Spaces reset");
  };
  $("#logout").onclick = () => {
    if (!confirm("Log out on this device? Your data stays in sync and is removed from this device only.")) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith("dash.")).forEach((k) => localStorage.removeItem(k)); } catch {}
    location.reload();
  };
  $("#openSettings").onclick = () => openSettings();
  sDlg.addEventListener("click", (e) => { if (e.target === sDlg) sDlg.close(); });
  document.addEventListener("click", (e) => { const s = e.target.closest("[data-settings]"); if (s) { e.preventDefault(); openSettings(s.dataset.settings); } });

  /* ═════════════════════════ Keyboard (Mac) ═════════════════════════ */
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || sDlg.open || itemDlg.open) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= cfg.spaces.length) setSpace(cfg.spaces[n - 1].id);
    else if (e.key === ",") openSettings();
    else if (e.key === "t") {
      const i = THEMES.findIndex((t) => t.id === document.documentElement.dataset.theme);
      applyTheme(THEMES[(i + 1) % THEMES.length].id);
    }
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

  /* ═════════════════════════ Lock screen: nothing is shown without a token on this device ═════════════════════════ */
  function showLock(message = "") {
    document.body.classList.add("locked");
    $("#lock").hidden = false;
    $("#lockErr").textContent = message;
    setTimeout(() => $("#lockToken").focus(), 50);
  }
  $("#lockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tok = $("#lockToken").value.trim(), btn = $("#lockForm button");
    if (!tok) return;
    btn.disabled = true; $("#lockErr").textContent = "Checking…";
    try {
      const r = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tok}` } });
      if (!r.ok) throw new Error(r.status === 401 ? "GitHub rejected this token — check it’s copied in full and hasn’t expired" : "GitHub responded " + r.status);
      const me = await r.json();
      store.set("token", tok); store.set("owner", me.login); sync.reset();
      if (!cfg.github.username) store.set("pendingUser", me.login);
      location.reload();
    } catch (err) {
      $("#lockErr").textContent = err.message === "Failed to fetch" ? "Can’t reach GitHub" : err.message;
      btn.disabled = false;
    }
  });
  window.Dash.onAuthError = () => showLock("This token no longer works — paste a new one");

  /* ═════════════════════════ Boot ═════════════════════════ */
  applyMotion();
  reduced.addEventListener?.("change", applyMotion);
  applyTheme(store.get("theme", BASE.theme || "damson"));
  if (!token()) { showLock(); return; }
  document.body.classList.remove("locked");
  migrateConfig();
  renderSpaces(); renderAll(); renderSyncStatus();
  sync.schedule(0);
  if (store.get("pendingUser", "")) setTimeout(() => {
    const u = store.get("pendingUser", ""); store.del("pendingUser");
    if (!cfg.github.username && u) { saveCfg({ github: { username: u } }); ghCache.clear(); renderAll(); }
  }, 4000);

  let lastDay = ymd(new Date());
  setInterval(() => {
    renderHeader();
    if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); renderGrid(); }
  }, 15 * 1000);
  setInterval(() => {
    ghCache.clear();
    const busy = document.activeElement?.matches("input, textarea") || itemDlg.open || sDlg.open;
    if (!busy && (currentSpace().widgets || []).includes("github")) renderGrid();
  }, 5 * 60 * 1000);
})();
