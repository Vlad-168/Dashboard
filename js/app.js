(() => {
  "use strict";
  const { store, db, sync, token } = window.Dash;

  /* ───────────── Config ───────────── */
  const BASE = window.DASHBOARD_CONFIG || {};
  let cfg;
  function loadConfig() {
    const o = db.get("cfg", null) || {};
    cfg = {
      name: o.name ?? BASE.name ?? "",
      github: { username: o.github?.username ?? BASE.github?.username ?? "" },
      spaces: o.spaces ?? BASE.spaces ?? [],
      schedule: o.schedule ?? BASE.schedule ?? {},
    };
    if (!cfg.spaces.length) cfg.spaces = [{ id: "main", name: "Главное", icon: "✦", widgets: ["today", "week", "github", "todo"] }];
  }
  loadConfig();

  const THEMES = [
    { id: "damson", name: "Damson", a: "#854c65", b: "#24131c", bar: "#1d0f17" },
    { id: "damson-light", name: "Damson Light", a: "#854c65", b: "#f7eef2", bar: "#f7eef2" },
    { id: "noir", name: "Noir", a: "#e7e7ea", b: "#09090b", bar: "#09090b" },
    { id: "sage", name: "Sage", a: "#8fb79b", b: "#0f1512", bar: "#0f1512" },
    { id: "sand", name: "Sand", a: "#a0623a", b: "#f5efe6", bar: "#f5efe6" },
    { id: "ocean", name: "Ocean", a: "#6aa8e8", b: "#08111c", bar: "#08111c" },
  ];

  /* ───────────── Helpers ───────────── */
  const $ = (s, r = document) => r.querySelector(s);
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_SHORT = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };
  const DAY_FULL = { mon: "Понедельник", tue: "Вторник", wed: "Среда", thu: "Четверг", fri: "Пятница", sat: "Суббота", sun: "Воскресенье" };
  const TYPES = { strength: ["🏋️", "Силовая"], cardio: ["🏃", "Кардио"], mobility: ["🧘", "Мобильность"], swim: ["🏊", "Плавание"], bike: ["🚴", "Велосипед"] };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const workoutsFor = (d) => (cfg.schedule[DAY_KEYS[d.getDay()]] || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const isMobile = () => matchMedia("(max-width: 720px)").matches;
  const haptic = () => { try { navigator.vibrate?.(8); } catch {} };
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " мин";
    if (s < 86400) return Math.round(s / 3600) + " ч";
    if (s < 86400 * 30) return Math.round(s / 86400) + " д";
    return Math.round(s / 86400 / 30) + " мес";
  }

  /* Отметки тренировок: db["done:2026-11-02"] = [0, 1] */
  const doneList = (date) => db.get("done:" + ymd(date), []);
  const isDone = (date, i) => doneList(date).includes(i);
  function toggleDone(date, i) {
    const set = new Set(doneList(date));
    set.has(i) ? set.delete(i) : set.add(i);
    db.set("done:" + ymd(date), [...set]);
    haptic();
    renderAll();
  }

  /* ───────────── Theme ───────────── */
  function applyTheme(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    document.documentElement.dataset.theme = t.id;
    $('meta[name="theme-color"]')?.setAttribute("content", t.bar);
    store.set("theme", t.id);
    document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === t.id)));
  }
  function renderThemes() {
    document.querySelectorAll("[data-themes]").forEach((box) => {
      box.innerHTML = THEMES.map((t) => `<button type="button" class="swatch" role="radio" title="${t.name}" aria-label="${t.name}" data-id="${t.id}" style="--a:${t.a};--b:${t.b}"></button>`).join("");
      box.onclick = (e) => { const b = e.target.closest(".swatch"); if (b) { applyTheme(b.dataset.id); haptic(); } };
    });
    applyTheme(store.get("theme", BASE.theme || "damson"));
  }

  /* ───────────── Header ───────────── */
  function greetingWord(h) {
    if (h >= 5 && h < 12) return "Доброе утро";
    if (h >= 12 && h < 17) return "Добрый день";
    if (h >= 17 && h < 23) return "Добрый вечер";
    return "Доброй ночи";
  }
  let ghCount = null;
  function renderHeader() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    $("#date").textContent = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    const name = cfg.name ? `, <em>${esc(cfg.name)}</em>` : "";
    $("#greeting").innerHTML = `${greetingWord(now.getHours())}${name}`;

    const parts = [];
    const today = workoutsFor(now);
    const left = today.filter((w) => !isDone(now, today.indexOf(w)));
    if (!today.length) parts.push("Сегодня день отдыха — восстановись как следует.");
    else if (!left.length) parts.push("Тренировки на сегодня выполнены. Отличная работа 💪");
    else parts.push(`Сегодня: ${esc(left[0].title)} в ${esc(left[0].time)}.`);
    if (ghCount === 0) parts.push("В GitHub всё чисто ✨");
    else if (ghCount != null) parts.push(`В GitHub ждут ${ghCount} ${plural(ghCount, "задача", "задачи", "задач")}.`);
    $("#subline").innerHTML = parts.join(" ");
  }

  function renderSyncStatus() {
    const dot = $("#syncDot"), line = $("#syncLine");
    const st = sync.enabled() ? sync.state : "off";
    dot.dataset.state = st;
    const when = sync.last ? new Date(sync.last).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—";
    const text = {
      off: token() ? "Синхронизация выключена" : "Добавь GitHub‑токен, чтобы синхронизировать Mac и телефон",
      syncing: "Синхронизирую…",
      ok: `Синхронизировано в ${when}`,
      error: `Ошибка синхронизации: ${sync.message}`,
    }[st];
    dot.title = text;
    if (line) line.textContent = text;
  }
  sync.onStatus = renderSyncStatus;

  /* ───────────── Spaces ───────────── */
  let active = store.get("space", cfg.spaces[0].id);
  const currentSpace = () => cfg.spaces.find((s) => s.id === active) || cfg.spaces[0];
  const spaceIndex = () => cfg.spaces.indexOf(currentSpace());
  function renderSpaces() {
    const nav = $("#spaces");
    nav.style.setProperty("--n", cfg.spaces.length);
    nav.innerHTML = cfg.spaces.map((s, i) =>
      `<button class="space" role="tab" data-id="${esc(s.id)}" aria-selected="${s.id === currentSpace().id}">
         <span class="space-ico">${esc(s.icon || "•")}</span><span class="space-name">${esc(s.name)}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}</button>`).join("");
    nav.onclick = (e) => { const b = e.target.closest(".space"); if (b) setSpace(b.dataset.id); };
  }
  function setSpace(id, dir = 0) {
    if (id === currentSpace().id) return;
    if (!dir) dir = cfg.spaces.findIndex((s) => s.id === id) > spaceIndex() ? 1 : -1;
    active = id; store.set("space", id); haptic();
    renderSpaces(); renderGrid(dir);
    if (isMobile()) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Свайп влево/вправо между пространствами (телефон) */
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

  /* ───────────── Widgets ───────────── */
  const WIDGETS = {
    today: { size: "", render: wToday },
    week: { size: "wide", render: wWeek },
    github: { size: "wide", render: wGithub },
    todo: { size: "", render: wTodo },
    stats: { size: "", render: wStats },
    focus: { size: "", render: wFocus },
  };

  function card(title, size, body, extra = "") {
    const el = document.createElement("article");
    el.className = "card " + size;
    el.innerHTML = `<div class="card-head"><h3>${title}</h3>${extra}</div>${body}`;
    return el;
  }

  function wToday(size) {
    const now = new Date(), list = workoutsFor(now);
    const doneN = list.filter((_, i) => isDone(now, i)).length;
    const pct = list.length ? Math.round((doneN / list.length) * 100) : 100;
    const first = list[0];
    const body = list.length
      ? `<div class="today-main">
           <div class="ring" style="--p:${pct}"><span>${TYPES[first.type]?.[0] || "⚡"}</span></div>
           <div><div class="big-title">${esc(list.length === 1 ? first.title : list.length + " " + plural(list.length, "тренировка", "тренировки", "тренировок"))}</div>
           <div class="wo-meta">${doneN}/${list.length} выполнено</div></div>
         </div>
         <ul class="workouts">${list.map((w, i) => `
           <li class="wo ${isDone(now, i) ? "done" : ""}">
             <button class="check ${isDone(now, i) ? "on" : ""}" data-i="${i}" aria-label="Отметить «${esc(w.title)}»">✓</button>
             <span class="wo-time">${esc(w.time || "")}</span>
             <span class="wo-title">${esc(w.title)}<div class="wo-meta">${w.duration ? w.duration + " мин" : ""}</div></span>
           </li>`).join("")}</ul>`
      : `<div class="today-main"><div class="ring" style="--p:100"><span>☕</span></div>
           <div><div class="big-title">День отдыха</div><div class="wo-meta">Сон, прогулка, растяжка</div></div></div>`;
    const el = card("Тренировка сегодня", size, body, `<span class="chip accent">${DAY_SHORT[DAY_KEYS[now.getDay()]]}</span>`);
    el.onclick = (e) => { const b = e.target.closest(".check"); if (b) toggleDone(now, +b.dataset.i); };
    return el;
  }

  function wWeek(size) {
    const now = new Date(), mon = mondayOf(now);
    const days = WEEK.map((k, idx) => {
      const d = addDays(mon, idx), list = workoutsFor(d), isToday = ymd(d) === ymd(now);
      return `<div class="day ${isToday ? "is-today" : ""}" data-date="${ymd(d)}">
        <div class="day-name"><span>${DAY_SHORT[k]}</span><span>${d.getDate()}</span></div>
        ${list.length ? list.map((w, i) => `<button class="pill t-${esc(w.type || "")} ${isDone(d, i) ? "done" : ""}" data-i="${i}" title="${esc(w.title)} — нажми, чтобы отметить">
            ${esc(w.title)}<small>${esc(w.time || "")}${w.duration ? " · " + w.duration + "м" : ""}</small></button>`).join("")
          : `<div class="rest">отдых</div>`}
      </div>`;
    }).join("");
    const range = `${mon.getDate()} – ${addDays(mon, 6).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
    const el = card("Неделя тренировок", size, `<div class="week">${days}</div>`, `<span class="chip">${range}</span>`);
    el.onclick = (e) => {
      const p = e.target.closest(".pill"); if (!p) return;
      const [y, m, d] = p.closest(".day").dataset.date.split("-").map(Number);
      toggleDone(new Date(y, m - 1, d), +p.dataset.i);
    };
    // На телефоне прокручиваем ленту так, чтобы сегодняшний день был в центре
    requestAnimationFrame(() => {
      const w = $(".week", el), t = $(".is-today", el);
      if (w && t && w.scrollWidth > w.clientWidth) w.scrollLeft = t.offsetLeft - (w.clientWidth - t.clientWidth) / 2;
    });
    return el;
  }

  function wStats(size) {
    const now = new Date(), mon = mondayOf(now);
    let planned = 0, completed = 0;
    const bars = WEEK.map((k, idx) => {
      const d = addDays(mon, idx), list = workoutsFor(d);
      const c = list.filter((_, i) => isDone(d, i)).length;
      planned += list.length; completed += c;
      return { k, h: list.length ? 20 + (c / list.length) * 80 : 6, on: c > 0 };
    });
    // Серия: дни подряд, где все запланированные тренировки выполнены (дни отдыха серию не рвут)
    let streak = 0;
    for (let i = 0, d = new Date(now); i < 365; i++, d = addDays(d, -1)) {
      const list = workoutsFor(d);
      if (!list.length) continue;
      if (list.every((_, j) => isDone(d, j))) streak++;
      else if (i === 0) continue; // сегодня ещё не закончено — не ломаем серию
      else break;
    }
    const month = db.keys("done:" + ymd(now).slice(0, 7)).reduce((s, k) => s + db.get(k, []).length, 0);
    const body = `<div class="stats">
        <div class="stat"><b>${completed}/${planned}</b><span>за неделю</span></div>
        <div class="stat"><b>${streak}</b><span>серия 🔥</span></div>
        <div class="stat"><b>${month}</b><span>в этом месяце</span></div>
      </div>
      <div class="bars">${bars.map((b) => `<i class="${b.on ? "on" : ""}" style="height:${b.h}%"></i>`).join("")}</div>
      <div class="bars-lbl">${bars.map((b) => `<span>${DAY_SHORT[b.k]}</span>`).join("")}</div>`;
    return card("Прогресс", size, body);
  }

  /* GitHub */
  const GH_TABS = [
    { id: "assigned", label: "Мне", q: (u) => `is:open assignee:${u} archived:false` },
    { id: "review", label: "Ревью", q: (u) => `is:open is:pr review-requested:${u} archived:false` },
    { id: "mine", label: "Мои PR", q: (u) => `is:open is:pr author:${u} archived:false` },
  ];
  const ghCache = new Map();
  let ghTab = store.get("ghTab", "assigned");

  async function ghFetch(query) {
    const hit = ghCache.get(query);
    if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.data;
    const headers = { Accept: "application/vnd.github+json" };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const r = await fetch(`https://api.github.com/search/issues?per_page=30&sort=updated&q=${encodeURIComponent(query)}`, { headers });
    if (!r.ok) throw new Error(r.status === 401 ? "Неверный токен" : r.status === 403 ? "Лимит запросов GitHub — добавь токен" : "GitHub: " + r.status);
    const data = await r.json();
    ghCache.set(query, { t: Date.now(), data });
    return data;
  }

  function wGithub(size) {
    const space = currentSpace();
    const tabs = `<div class="gh-tabs">${GH_TABS.map((t) => `<button data-t="${t.id}" class="${t.id === ghTab ? "on" : ""}">${t.label}</button>`).join("")}</div>`;
    const el = card("GitHub", size, `<ul class="gh-list"><li class="empty">Загружаю…</li></ul>`, tabs);
    const list = $(".gh-list", el);
    el.querySelector(".gh-tabs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      ghTab = b.dataset.t; store.set("ghTab", ghTab); haptic(); el.replaceWith(wGithub(size));
    };
    const user = cfg.github.username;
    if (!user) { list.innerHTML = `<li class="empty">Укажи GitHub username в <a href="#" data-settings>настройках</a>.</li>`; return el; }

    const repos = (space.repos || []).map((r) => ` repo:${r}`).join("");
    const tab = GH_TABS.find((t) => t.id === ghTab) || GH_TABS[0];
    ghFetch(tab.q(user) + repos).then((data) => {
      if (tab.id === "assigned") { ghCount = data.total_count; renderHeader(); }
      if (!data.items.length) { list.innerHTML = `<li class="empty">Пусто — можно выдохнуть ✨</li>`; return; }
      list.innerHTML = data.items.map((it) => {
        const repo = it.repository_url.split("/repos/")[1];
        const pr = !!it.pull_request;
        return `<li class="gh-item"><a href="${esc(it.html_url)}" target="_blank" rel="noopener">
          <span class="gh-ico ${pr ? "pr" : ""}">${pr ? "⇄" : "◉"}</span>
          <span><div class="gh-title">${esc(it.title)}</div>
            <div class="gh-repo">${esc(repo)} #${it.number}</div>
            ${it.labels.length ? `<div class="gh-labels">${it.labels.slice(0, 4).map((l) => `<span class="gh-label" style="border-color:#${esc(l.color)}">${esc(l.name)}</span>`).join("")}</div>` : ""}
          </span>
          <span class="gh-age">${ago(it.updated_at)}</span></a></li>`;
      }).join("");
    }).catch((err) => {
      list.innerHTML = `<li class="empty">${esc(err.message)}. <a href="#" data-settings>Настройки</a></li>`;
    });
    return el;
  }

  /* Todo (своё у каждого пространства, синхронизируется) */
  function wTodo(size) {
    const sid = currentSpace().id, key = "todo:" + sid;
    const items = db.get(key, []).slice();
    const left = items.filter((t) => !t.done).length;
    const body = `<form class="todo-add"><input placeholder="Новая задача…" maxlength="200" enterkeyhint="done" /><button class="btn" type="submit" aria-label="Добавить">＋</button></form>
      <ul class="todo-list">${items.length ? items.map((t, i) => `
        <li class="todo ${t.done ? "done" : ""}"><button class="check ${t.done ? "on" : ""}" data-i="${i}" aria-label="Готово">✓</button>
        <span>${esc(t.text)}</span><button class="del" data-del="${i}" title="Удалить" aria-label="Удалить">✕</button></li>`).join("")
        : `<li class="empty">Здесь будут твои задачи для «${esc(currentSpace().name)}»</li>`}</ul>`;
    const el = card("Задачи", size, body, `<span class="chip">${left} осталось</span>`);
    const save = (next, refocus) => {
      db.set(key, next);
      const fresh = wTodo(size);
      el.replaceWith(fresh);
      if (refocus) $("input", fresh).focus();
    };
    $("form", el).onsubmit = (e) => {
      e.preventDefault();
      const v = $("input", el).value.trim();
      if (v) { haptic(); save([{ text: v, done: false }, ...items], true); }
    };
    el.addEventListener("click", (e) => {
      const c = e.target.closest(".check"), d = e.target.closest("[data-del]");
      if (c) { haptic(); items[+c.dataset.i] = { ...items[+c.dataset.i], done: !items[+c.dataset.i].done }; save(items.sort((a, b) => a.done - b.done)); }
      if (d) { items.splice(+d.dataset.del, 1); save(items); }
    });
    return el;
  }

  /* Фокус‑таймер (общий для всех пространств; считает от времени окончания, чтобы не сбиваться в фоне на iPhone) */
  const focus = { mode: "work", left: 25 * 60, endAt: 0, timer: null };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  function focusTick() {
    if (!focus.endAt) return;
    focus.left = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
    if (focus.left <= 0) {
      clearInterval(focus.timer); focus.endAt = 0;
      try { new Notification(focus.mode === "work" ? "Время перерыва ☕" : "Снова в фокус 🎯"); } catch {}
      try { navigator.vibrate?.([120, 80, 120]); } catch {}
      focus.mode = focus.mode === "work" ? "break" : "work";
      focus.left = (focus.mode === "work" ? 25 : 5) * 60;
      renderGrid();
      return;
    }
    const live = $(".focus-time");
    if (live) live.textContent = fmt(focus.left);
  }
  function wFocus(size) {
    const running = !!focus.endAt;
    const body = `<div class="focus-time">${fmt(focus.left)}</div>
      <div class="focus-btns">
        <button class="primary" data-a="toggle">${running ? "Пауза" : "Старт"}</button>
        <button class="btn" data-a="work">25</button><button class="btn" data-a="break">5</button>
      </div>`;
    const el = card("Фокус", size, body, `<span class="chip ${focus.mode === "work" ? "accent" : ""}">${focus.mode === "work" ? "работа" : "перерыв"}</span>`);
    el.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      haptic();
      clearInterval(focus.timer);
      if (a === "toggle" && !running) {
        focus.endAt = Date.now() + focus.left * 1000;
        focus.timer = setInterval(focusTick, 500);
        try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch {}
      } else if (a === "toggle") {
        focusTick(); focus.endAt = 0;
      } else { focus.mode = a; focus.left = (a === "work" ? 25 : 5) * 60; focus.endAt = 0; }
      el.replaceWith(wFocus(size));
    };
    return el;
  }

  /* ───────────── Grid ───────────── */
  function renderGrid(dir = 0) {
    const grid = $("#grid");
    grid.innerHTML = "";
    grid.dataset.dir = dir > 0 ? "next" : dir < 0 ? "prev" : "";
    (currentSpace().widgets || []).forEach((id, i) => {
      const w = WIDGETS[id]; if (!w) return;
      const el = w.render(w.size);
      el.style.animationDelay = i * 50 + "ms";
      grid.appendChild(el);
    });
  }
  function renderAll() { renderHeader(); renderGrid(); }

  /* Пришли изменения с другого устройства */
  db.onRemoteChange(() => {
    const typing = document.activeElement?.matches("input, textarea");
    loadConfig();
    renderSpaces(); renderHeader();
    if (!typing) renderGrid();
  });

  /* ───────────── Settings ───────────── */
  const dlg = $("#settings"), form = $("#settingsForm");
  let draft = {};

  function scheduleEditorHTML() {
    return WEEK.map((k) => `
      <section class="sd" data-day="${k}">
        <header><b>${DAY_FULL[k]}</b><button type="button" class="link" data-add="${k}">+ тренировка</button></header>
        ${(draft[k] || []).map((w, i) => `
          <div class="sr" data-i="${i}">
            <input type="time" name="time" value="${esc(w.time || "")}" aria-label="Время" />
            <input name="title" value="${esc(w.title || "")}" placeholder="Название" aria-label="Название" />
            <input type="number" name="duration" value="${esc(w.duration ?? "")}" min="0" step="5" inputmode="numeric" placeholder="мин" aria-label="Минут" />
            <select name="type" aria-label="Тип">${Object.entries(TYPES).map(([id, [ico, label]]) => `<option value="${id}" ${w.type === id ? "selected" : ""}>${ico} ${label}</option>`).join("")}</select>
            <button type="button" class="icon-btn sm" data-rm="${k}:${i}" aria-label="Удалить">✕</button>
          </div>`).join("") || `<p class="rest">отдых</p>`}
      </section>`).join("");
  }
  function readScheduleEditor() {
    const out = {};
    document.querySelectorAll("#schedEditor .sd").forEach((sec) => {
      out[sec.dataset.day] = [...sec.querySelectorAll(".sr")].map((r) => ({
        time: r.querySelector('[name="time"]').value,
        title: r.querySelector('[name="title"]').value.trim(),
        duration: +r.querySelector('[name="duration"]').value || 0,
        type: r.querySelector('[name="type"]').value,
      }));
    });
    return out;
  }
  function renderScheduleEditor() { $("#schedEditor").innerHTML = scheduleEditorHTML(); }
  $("#schedEditor").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]"), rm = e.target.closest("[data-rm]");
    if (!add && !rm) return;
    draft = readScheduleEditor();
    if (add) (draft[add.dataset.add] ||= []).push({ time: "07:30", title: "", duration: 45, type: "strength" });
    if (rm) { const [k, i] = rm.dataset.rm.split(":"); draft[k].splice(+i, 1); }
    renderScheduleEditor();
    if (add) $(`.sd[data-day="${add.dataset.add}"] .sr:last-of-type [name="title"]`)?.focus();
  });

  function openSettings() {
    form.name.value = cfg.name;
    form.ghUser.value = cfg.github.username || "";
    form.ghToken.value = store.get("token", "");
    form.syncOn.checked = store.get("syncOn", true);
    form.spaces.value = JSON.stringify(cfg.spaces, null, 2);
    draft = JSON.parse(JSON.stringify(cfg.schedule));
    renderScheduleEditor();
    renderSyncStatus();
    $("#settingsErr").textContent = "";
    dlg.showModal();
  }
  form.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    try {
      const spaces = JSON.parse(form.spaces.value);
      if (!Array.isArray(spaces) || !spaces.length) throw new Error("нужно хотя бы одно пространство");
      const schedule = readScheduleEditor();
      for (const k of WEEK) schedule[k] = schedule[k].filter((w) => w.title);
      const next = { name: form.name.value.trim(), github: { username: form.ghUser.value.trim() }, spaces, schedule };
      if (JSON.stringify(next) !== JSON.stringify(db.get("cfg", null))) db.set("cfg", next);

      const tok = form.ghToken.value.trim();
      if (tok !== store.get("token", "")) { store.set("token", tok); sync.reset(); }
      store.set("syncOn", form.syncOn.checked);

      ghCache.clear(); ghCount = null;
      loadConfig(); renderSpaces(); renderAll();
      sync.schedule(0); renderSyncStatus();
    } catch (err) { e.preventDefault(); $("#settingsErr").textContent = "Ошибка: " + err.message; }
  });
  $("#syncNow").onclick = () => {
    if (form.ghToken.value.trim() !== store.get("token", "")) { store.set("token", form.ghToken.value.trim()); sync.reset(); }
    store.set("syncOn", true); form.syncOn.checked = true;
    sync.run();
  };
  $("#resetSettings").onclick = () => {
    if (!confirm("Вернуть пространства, имя и расписание из config? Отметки и задачи сохранятся.")) return;
    db.set("cfg", null); ghCache.clear(); loadConfig(); dlg.close(); renderSpaces(); renderAll();
  };
  $("#openSettings").onclick = openSettings;
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // тап по фону закрывает
  document.addEventListener("click", (e) => { if (e.target.closest("[data-settings]")) { e.preventDefault(); openSettings(); } });

  /* ───────────── Keyboard (Mac) ───────────── */
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || dlg.open) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= cfg.spaces.length) setSpace(cfg.spaces[n - 1].id);
    else if (e.key === ",") openSettings();
    else if (e.key === "t") {
      const i = THEMES.findIndex((t) => t.id === document.documentElement.dataset.theme);
      applyTheme(THEMES[(i + 1) % THEMES.length].id);
    }
  });

  /* ───────────── Boot & timers ───────────── */
  renderThemes(); renderSpaces(); renderAll(); renderSyncStatus();
  sync.schedule(0);
  let lastDay = ymd(new Date());
  setInterval(() => {
    renderHeader();
    if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); renderGrid(); }
  }, 15 * 1000);
  setInterval(() => {
    ghCache.clear();
    const typing = document.activeElement?.matches("input, textarea");
    if (!typing && (currentSpace().widgets || []).includes("github")) renderGrid();
  }, 5 * 60 * 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
