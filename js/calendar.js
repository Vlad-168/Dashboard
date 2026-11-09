/*
 * Calendar rendering shared by the dashboard (Home) and the public share page.
 * Pure functions: events in → HTML strings out.
 *
 * Event: { key, date: "YYYY-MM-DD", to?: "YYYY-MM-DD" (all-day range), time?: "HH:MM", dur?: minutes,
 *          title, sub?, kind: "training" | "lesson" | "tournament", tone?: "gym"|"tennis"|"padel"|…,
 *          status?: "done" | "cancel" | "pending" | "planned", icon? }
 */
(() => {
  "use strict";
  const LOCALE = "en-GB";
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (d, o) => d.toLocaleDateString(LOCALE, o);
  const endTime = (e) => {
    if (!e.time || !e.dur) return "";
    const [h, m] = e.time.split(":").map(Number), t = h * 60 + m + e.dur;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
  };

  // Expand all-day ranges onto each day and sort: all-day first, then by time
  function byDate(events) {
    const out = {};
    for (const e of events) {
      if (e.to && e.to > e.date) {
        for (let d = parse(e.date); ymd(d) <= e.to; d = addDays(d, 1)) (out[ymd(d)] ||= []).push(e);
      } else (out[e.date] ||= []).push(e);
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time || "").localeCompare(b.time || ""));
    return out;
  }

  const cls = (e) => `ev k-${e.kind} t-${esc(e.tone || e.kind)} s-${esc(e.status || "planned")}`;
  const attrs = (e, dateKey) => `data-ev="${esc(e.key)}" data-date="${dateKey}"`;

  function chip(e, dateKey, mode) {
    const time = e.time ? `<span class="ev-time">${esc(e.time)}${mode === "full" && e.dur ? `–${endTime(e)}` : ""}</span>` : "";
    const sub = mode !== "mini" && e.sub ? `<span class="ev-sub">${esc(e.sub)}</span>` : "";
    return `<button class="${cls(e)}" ${attrs(e, dateKey)} title="${esc(`${e.time ? e.time + " " : ""}${e.title}${e.sub ? " · " + e.sub : ""}`)}">
      ${time}<span class="ev-title">${e.icon ? `<i>${e.icon}</i>` : ""}${esc(e.title)}</span>${sub}</button>`;
  }

  function weekHTML(events, anchor, todayKey) {
    const mon = mondayOf(anchor), map = byDate(events);
    return `<div class="cal-week">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i), k = ymd(d), list = map[k] || [];
      return `<div class="cal-col ${k === todayKey ? "is-today" : ""} ${i > 4 ? "weekend" : ""}" data-day="${k}">
        <div class="cal-col-head"><span>${fmt(d, { weekday: "short" })}</span><b>${d.getDate()}</b></div>
        <div class="cal-col-body">${list.map((e) => chip(e, k, "full")).join("") || `<span class="cal-free">free</span>`}</div>
      </div>`;
    }).join("")}</div>`;
  }

  function monthHTML(events, anchor, todayKey, selKey) {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1), start = mondayOf(first), map = byDate(events);
    const heads = Array.from({ length: 7 }, (_, i) => `<span>${fmt(addDays(start, i), { weekday: "short" })}</span>`).join("");
    const weeks = ymd(addDays(start, 35)) <= ymd(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)) ? 6 : 5;
    const cells = Array.from({ length: weeks * 7 }, (_, i) => {
      const d = addDays(start, i), k = ymd(d), list = map[k] || [], out = d.getMonth() !== anchor.getMonth();
      const shown = list.slice(0, 3);
      return `<button class="cal-cell ${out ? "out" : ""} ${k === todayKey ? "is-today" : ""} ${k === selKey ? "is-sel" : ""}" data-day="${k}">
        <span class="cal-num">${d.getDate()}</span>
        <span class="cal-dots">${list.slice(0, 5).map((e) => `<i class="dot t-${esc(e.tone || e.kind)} s-${esc(e.status || "planned")}"></i>`).join("")}</span>
        <span class="cal-mini">${shown.map((e) => `<span class="${cls(e)}">${e.time ? `<b>${esc(e.time)}</b> ` : ""}${esc(e.title)}</span>`).join("")}${list.length > 3 ? `<span class="cal-more">+${list.length - 3}</span>` : ""}</span>
      </button>`;
    }).join("");
    return `<div class="cal-month"><div class="cal-heads">${heads}</div><div class="cal-grid">${cells}</div></div>`;
  }

  function listHTML(events, fromKey, days, emptyText = "Nothing planned") {
    const map = byDate(events), start = parse(fromKey), groups = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i), k = ymd(d), list = map[k] || [];
      if (!list.length) continue;
      groups.push(`<section class="cal-day" data-day="${k}">
        <header><b>${fmt(d, { weekday: "long" })}</b><span>${fmt(d, { day: "numeric", month: "long" })}</span></header>
        <div class="cal-day-list">${list.map((e) => chip(e, k, "full")).join("")}</div></section>`);
    }
    return groups.length ? `<div class="cal-list">${groups.join("")}</div>` : `<p class="empty">${esc(emptyText)}</p>`;
  }

  function rangeLabel(view, anchor) {
    if (view === "month") return fmt(anchor, { month: "long", year: "numeric" });
    const mon = mondayOf(anchor), sun = addDays(mon, 6);
    if (view === "list") return `From ${fmt(anchor, { day: "numeric", month: "short" })}`;
    return mon.getMonth() === sun.getMonth()
      ? `${mon.getDate()} – ${fmt(sun, { day: "numeric", month: "long" })}`
      : `${fmt(mon, { day: "numeric", month: "short" })} – ${fmt(sun, { day: "numeric", month: "short" })}`;
  }

  // Move the anchor by one page of the current view
  function shift(view, anchor, dir) {
    if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
    return addDays(anchor, dir * (view === "list" ? 14 : 7));
  }

  /* iCalendar (.ics) — floating local times so events show at the same clock time */
  function icsText(events, { name = "Schedule", prodId = "-//Dashboard//Calendar//EN" } = {}) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const escI = (s) => String(s ?? "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
    const dt = (k, t) => `${k.replace(/-/g, "")}T${t.replace(":", "")}00`;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${prodId}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `X-WR-CALNAME:${escI(name)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
    for (const e of events) {
      if (e.status === "cancel") continue;
      lines.push("BEGIN:VEVENT", `UID:${escI(e.key)}@dashboard`, `DTSTAMP:${stamp}`);
      if (e.time) {
        lines.push(`DTSTART:${dt(e.date, e.time)}`, `DTEND:${dt(e.date, endTime({ ...e, dur: e.dur || 60 }) || e.time)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${ymd(addDays(parse(e.to || e.date), 1)).replace(/-/g, "")}`);
      }
      lines.push(`SUMMARY:${escI((e.icon ? e.icon + " " : "") + e.title)}`);
      if (e.sub) lines.push(`LOCATION:${escI(e.sub)}`);
      if (e.status === "pending") lines.push("STATUS:TENTATIVE");
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  window.Cal = { ymd, parse, addDays, mondayOf, byDate, weekHTML, monthHTML, listHTML, rangeLabel, shift, icsText, esc };
})();
