(() => {
  "use strict";

  /* ───────────── Storage (safe) ───────────── */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("dash." + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("dash." + key, JSON.stringify(val)); } catch {} },
    del(key) { try { localStorage.removeItem("dash." + key); } catch {} },
  };

  /* ───────────── Config ───────────── */
  const BASE = window.DASHBOARD_CONFIG || {};
  let cfg;
  function loadConfig() {
    const o = store.get("cfg", {});
    cfg = {
      name: o.name ?? BASE.name ?? "",
      github: { ...(BASE.github || {}), ...(o.github || {}) },
      spaces: o.spaces ?? BASE.spaces ?? [],
      schedule: o.schedule ?? BASE.schedule ?? {},
    };
    if (!cfg.spaces.length) cfg.spaces = [{ id: "main", name: "Главное", icon: "✦", widgets: ["today", "week", "github", "todo"] }];
  }
  loadConfig();

  const THEMES = [
    { id: "damson", name: "Damson", a: "#854c65", b: "#24131c" },
    { id: "damson-light", name: "Damson Light", a: "#854c65", b: "#f7eef2" },
    { id: "noir", name: "Noir", a: "#e7e7ea", b: "#09090b" },
    { id: "sage", name: "Sage", a: "#8fb79b", b: "#0f1512" },
    { id: "sand", name: "Sand", a: "#a0623a", b: "#f5efe6" },
    { id: "ocean", name: "Ocean", a: "#6aa8e8", b: "#08111c" },
  ];

  /* ───────────── Helpers ───────────── */
  const $ = (s, r = document) => r.querySelector(s);
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_SHORT = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };
  const TYPE_ICON = { strength: "🏋️", cardio: "🏃", mobility: "🧘", swim: "🏊", bike: "🚴" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const workoutsFor = (d) => (cfg.schedule[DAY_KEYS[d.getDay()]] || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
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

  /* Done-state for workouts: { "2026-11-02": [0, 1] } */
  let done = store.get("done", {});
  const isDone = (date, i) => (done[ymd(date)] || []).includes(i);
  function toggleDone(date, i) {
    const k = ymd(date), arr = new Set(done[k] || []);
    arr.has(i) ? arr.delete(i) : arr.add(i);
    done[k] = [...arr];
    store.set("done", done);
    renderAll();
  }

  /* ───────────── Theme ───────────── */
  function applyTheme(id) {
    document.documentElement.dataset.theme = id;
    store.set("theme", id);
    document.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === id)));
  }
  function renderThemes() {
    const box = $("#themes");
    box.innerHTML = THEMES.map((t) => `<button class="swatch" role="radio" title="${t.name}" data-id="${t.id}" style="--a:${t.a};--b:${t.b}"></button>`).join("");
    box.onclick = (e) => { const b = e.target.closest(".swatch"); if (b) applyTheme(b.dataset.id); };
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
    const left = today.filter((_, i) => !isDone(now, i));
    if (!today.length) parts.push("Сегодня день отдыха — восстановись как следует.");
    else if (!left.length) parts.push("Тренировки на сегодня выполнены. Отличная работа 💪");
    else parts.push(`Сегодня: ${esc(left[0].title)} в ${esc(left[0].time)}.`);
    if (ghCount === 0) parts.push("В GitHub всё чисто ✨");
    else if (ghCount != null) parts.push(`В GitHub ждут ${ghCount} ${plural(ghCount, "задача", "задачи", "задач")}.`);
    $("#subline").innerHTML = parts.join(" ");
  }

  /* ───────────── Spaces ───────────── */
  let active = store.get("space", cfg.spaces[0].id);
  const currentSpace = () => cfg.spaces.find((s) => s.id === active) || cfg.spaces[0];
  function renderSpaces() {
    const nav = $("#spaces");
    nav.innerHTML = cfg.spaces.map((s, i) =>
      `<button class="space" role="tab" data-id="${esc(s.id)}" aria-selected="${s.id === currentSpace().id}">
         <span>${esc(s.icon || "")}</span>${esc(s.name)}${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}</button>`).join("");
    nav.onclick = (e) => { const b = e.target.closest(".space"); if (b) setSpace(b.dataset.id); };
  }
  function setSpace(id) { active = id; store.set("space", id); renderSpaces(); renderGrid(); }

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
           <div class="ring" style="--p:${pct}"><span>${TYPE_ICON[first.type] || "⚡"}</span></div>
           <div><div class="big-title">${esc(list.length === 1 ? first.title : list.length + " " + plural(list.length, "тренировка", "тренировки", "тренировок"))}</div>
           <div class="wo-meta">${doneN}/${list.length} выполнено</div></div>
         </div>
         <ul class="workouts">${list.map((w, i) => `
           <li class="wo ${isDone(now, i) ? "done" : ""}">
             <button class="check ${isDone(now, i) ? "on" : ""}" data-i="${i}" aria-label="Отметить">✓</button>
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
      return `<div class="day ${isToday ? "is-today" : ""}">
        <div class="day-name"><span>${DAY_SHORT[k]}</span><span>${d.getDate()}</span></div>
        ${list.length ? list.map((w, i) => `<div class="pill t-${esc(w.type || "")} ${isDone(d, i) ? "done" : ""}" title="${esc(w.title)}">
            ${esc(w.title)}<small>${esc(w.time || "")}${w.duration ? " · " + w.duration + "м" : ""}</small></div>`).join("")
          : `<div class="rest">отдых</div>`}
      </div>`;
    }).join("");
    const range = `${mon.getDate()} – ${addDays(mon, 6).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
    return card("Неделя тренировок", size, `<div class="week">${days}</div>`, `<span class="chip">${range}</span>`);
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
    // Streak: consecutive past days where every planned workout was done (rest days don't break it)
    let streak = 0;
    for (let i = 0, d = new Date(now); i < 365; i++, d = addDays(d, -1)) {
      const list = workoutsFor(d);
      if (!list.length) continue;
      const all = list.every((_, j) => isDone(d, j));
      if (all) streak++;
      else if (i === 0) continue; // сегодня ещё не закончено — не ломаем серию
      else break;
    }
    const month = Object.entries(done).filter(([k]) => k.startsWith(ymd(now).slice(0, 7))).reduce((s, [, v]) => s + v.length, 0);
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
    if (cfg.github.token) headers.Authorization = `Bearer ${cfg.github.token}`;
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
      ghTab = b.dataset.t; store.set("ghTab", ghTab); el.replaceWith(wGithub(size));
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

  /* Todo (per space) */
  function wTodo(size) {
    const sid = currentSpace().id, key = "todo." + sid;
    const items = store.get(key, []);
    const left = items.filter((t) => !t.done).length;
    const body = `<form class="todo-add"><input placeholder="Новая задача…" maxlength="200" /><button class="btn" type="submit">＋</button></form>
      <ul class="todo-list">${items.length ? items.map((t, i) => `
        <li class="todo ${t.done ? "done" : ""}"><button class="check ${t.done ? "on" : ""}" data-i="${i}">✓</button>
        <span>${esc(t.text)}</span><button class="del" data-del="${i}" title="Удалить">✕</button></li>`).join("")
        : `<li class="empty">Здесь будут твои задачи для «${esc(currentSpace().name)}»</li>`}</ul>`;
    const el = card("Задачи", size, body, `<span class="chip">${left} осталось</span>`);
    const save = (next) => { store.set(key, next); el.replaceWith(wTodo(size)); };
    $("form", el).onsubmit = (e) => {
      e.preventDefault();
      const v = $("input", el).value.trim();
      if (v) save([{ text: v, done: false }, ...items]);
    };
    el.addEventListener("click", (e) => {
      const c = e.target.closest(".check"), d = e.target.closest("[data-del]");
      if (c) { items[+c.dataset.i].done = !items[+c.dataset.i].done; save(items.sort((a, b) => a.done - b.done)); }
      if (d) { items.splice(+d.dataset.del, 1); save(items); }
    });
    return el;
  }

  /* Focus timer (shared across spaces) */
  const focus = { mode: "work", left: 25 * 60, running: false, timer: null };
  function wFocus(size) {
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const body = `<div class="focus-time">${fmt(focus.left)}</div>
      <div class="focus-btns">
        <button class="primary" data-a="toggle">${focus.running ? "Пауза" : "Старт"}</button>
        <button class="btn" data-a="work">25</button><button class="btn" data-a="break">5</button>
      </div>`;
    const el = card("Фокус", size, body, `<span class="chip ${focus.mode === "work" ? "accent" : ""}">${focus.mode === "work" ? "работа" : "перерыв"}</span>`);
    const tick = () => {
      focus.left--;
      if (focus.left <= 0) {
        focus.running = false; clearInterval(focus.timer);
        try { new Notification(focus.mode === "work" ? "Время перерыва ☕" : "Снова в фокус 🎯"); } catch {}
        focus.mode = focus.mode === "work" ? "break" : "work";
        focus.left = (focus.mode === "work" ? 25 : 5) * 60;
      }
      const live = document.querySelector(".focus-time");
      if (live) live.textContent = fmt(focus.left);
      if (!focus.running) renderGrid();
    };
    el.onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      clearInterval(focus.timer);
      if (a === "toggle") {
        focus.running = !focus.running;
        if (focus.running) { try { Notification.requestPermission?.(); } catch {} }
      } else { focus.mode = a; focus.left = (a === "work" ? 25 : 5) * 60; focus.running = false; }
      if (focus.running) focus.timer = setInterval(tick, 1000);
      el.replaceWith(wFocus(size));
    };
    return el;
  }

  /* ───────────── Grid ───────────── */
  function renderGrid() {
    const grid = $("#grid");
    grid.innerHTML = "";
    (currentSpace().widgets || []).forEach((id, i) => {
      const w = WIDGETS[id]; if (!w) return;
      const el = w.render(w.size);
      el.style.animationDelay = i * 60 + "ms";
      grid.appendChild(el);
    });
  }
  function renderAll() { renderHeader(); renderGrid(); }

  /* ───────────── Settings ───────────── */
  const dlg = $("#settings"), form = $("#settingsForm");
  function openSettings() {
    form.name.value = cfg.name;
    form.ghUser.value = cfg.github.username || "";
    form.ghToken.value = cfg.github.token || "";
    form.spaces.value = JSON.stringify(cfg.spaces, null, 2);
    form.schedule.value = JSON.stringify(cfg.schedule, null, 2);
    $("#settingsErr").textContent = "";
    dlg.showModal();
  }
  form.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    try {
      const spaces = JSON.parse(form.spaces.value), schedule = JSON.parse(form.schedule.value);
      if (!Array.isArray(spaces) || !spaces.length) throw new Error("Нужно хотя бы одно пространство");
      store.set("cfg", {
        name: form.name.value.trim(),
        github: { username: form.ghUser.value.trim(), token: form.ghToken.value.trim() },
        spaces, schedule,
      });
      ghCache.clear(); ghCount = null;
      loadConfig(); renderSpaces(); renderAll();
    } catch (err) { e.preventDefault(); $("#settingsErr").textContent = "Ошибка: " + err.message; }
  });
  $("#resetSettings").onclick = () => { store.del("cfg"); ghCache.clear(); loadConfig(); dlg.close(); renderSpaces(); renderAll(); };
  $("#openSettings").onclick = openSettings;
  document.addEventListener("click", (e) => { if (e.target.closest("[data-settings]")) { e.preventDefault(); openSettings(); } });

  /* ───────────── Keyboard ───────────── */
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || dlg.open) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= cfg.spaces.length) setSpace(cfg.spaces[n - 1].id);
    else if (e.key === ",") openSettings();
    else if (e.key === "t") {
      const i = THEMES.findIndex((t) => t.id === document.documentElement.dataset.theme);
      applyTheme(THEMES[(i + 1) % THEMES.length].id);
    }
  });

  /* ───────────── Boot & timers ───────────── */
  renderThemes(); renderSpaces(); renderAll();
  let lastDay = ymd(new Date());
  setInterval(() => {
    renderHeader();
    if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); renderGrid(); }
  }, 15 * 1000);
  setInterval(() => { ghCache.clear(); if ((currentSpace().widgets || []).includes("github")) renderGrid(); }, 5 * 60 * 1000);
})();
