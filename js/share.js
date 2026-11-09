/* Public, read-only view of a shared schedule (published by the dashboard to a secret gist). */
(() => {
  "use strict";
  const C = window.Cal, $ = (s, r = document) => r.querySelector(s);
  const id = (location.hash || "").replace(/^#/, "").trim();
  const grid = $("#sGrid");
  let data = null, view = matchMedia("(max-width: 720px)").matches ? "list" : "week", anchor = new Date(), sel = C.ymd(new Date());

  function message(title, text) {
    grid.innerHTML = `<article class="card full"><div class="card-head"><h3>${C.esc(title)}</h3></div><p class="muted">${C.esc(text)}</p></article>`;
  }
  async function load() {
    if (!/^[0-9a-f]{20,40}$/i.test(id)) return message("Link not found", "This link is incomplete. Ask for it again.");
    try {
      const r = await fetch(`https://api.github.com/gists/${id}`, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } });
      if (r.status === 404) return message("Not shared anymore", "The owner stopped sharing this schedule.");
      if (r.status === 403) return message("Too many visits", "GitHub limits how often a page can load. Try again in a few minutes.");
      const g = await r.json();
      const f = g.files && g.files["share.json"];
      if (!f) return message("Not shared anymore", "The owner stopped sharing this schedule.");
      data = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
      const ics = g.files["calendar.ics"];
      if (ics && g.owner) {
        const url = `https://gist.githubusercontent.com/${g.owner.login}/${id}/raw/calendar.ics`;
        $("#sApple").href = url.replace(/^https:/, "webcal:");
        $("#sGoogle").href = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https:/, "webcal:"))}`;
        $("#sSubscribe").hidden = false;
      }
      render();
    } catch (e) {
      message("Couldn’t load", "Check your connection and refresh the page.");
    }
  }

  function render() {
    document.title = data.title;
    $("#sTitle").innerHTML = C.esc(data.title).replace(/^(.+?)(’s schedule)$/, "<em>$1</em>$2");
    const upd = new Date(data.generatedAt);
    $("#sUpdated").textContent = `Updated ${upd.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, ${upd.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    const todayK = C.ymd(new Date());
    const now = new Date(), nowStr = `${todayK} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const next = data.events.filter((e) => e.time && `${e.date} ${e.time}` >= nowStr && e.status !== "cancel")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    $("#sSub").textContent = next ? `Next: ${next.title} — ${C.parse(next.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at ${next.time}.` : "Nothing planned right now.";

    let body;
    if (view === "month") {
      const selList = data.events.filter((e) => e.date === sel || (e.to && e.date <= sel && sel <= e.to));
      body = C.monthHTML(data.events, anchor, todayK, sel) + `<div class="cal-sel">${C.listHTML(selList, sel, 1, "Nothing on this day")}</div>`;
    } else if (view === "list") body = C.listHTML(data.events, C.ymd(anchor), 28, "Nothing planned");
    else body = C.weekHTML(data.events, anchor, todayK);
    grid.innerHTML = `<article class="card full share-card">
      <div class="card-head"><h3>Calendar</h3><div class="head-actions"><div class="seg">${[["week", "Week"], ["month", "Month"], ["list", "List"]].map(([k, l]) => `<button data-view="${k}" class="${k === view ? "on" : ""}">${l}</button>`).join("")}</div></div></div>
      <div class="card-body">
        <div class="cal-toolbar"><div class="cal-nav"><button class="icon-btn sm" data-nav="-1" aria-label="Previous">‹</button><button class="btn sm" data-nav="0">Today</button><button class="icon-btn sm" data-nav="1" aria-label="Next">›</button>
          <span class="cal-range">${C.rangeLabel(view, anchor)}</span></div>
          <div class="cal-legend"><span class="lg t-gym">Training</span><span class="lg t-padel">Padel</span><span class="lg t-tennis">Tennis</span><span class="lg t-tour">Tournament</span></div></div>
        <div class="cal-view v-${view}">${body}</div>
      </div></article>`;
    requestAnimationFrame(() => {
      const w = $(".cal-week"), t = $(".cal-col.is-today");
      if (w && t && w.scrollWidth > w.clientWidth) w.scrollLeft = t.offsetLeft - (w.clientWidth - t.clientWidth) / 2;
    });
  }

  grid.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]"), n = e.target.closest("[data-nav]"), cell = e.target.closest(".cal-cell[data-day]");
    if (v) { view = v.dataset.view; render(); }
    if (n) { const d = +n.dataset.nav; anchor = d ? C.shift(view, anchor, d) : new Date(); if (!d) sel = C.ymd(new Date()); render(); }
    if (cell) { sel = cell.dataset.day; render(); }
  });
  addEventListener("hashchange", () => location.reload());
  load();
})();
