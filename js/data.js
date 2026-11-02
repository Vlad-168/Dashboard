/*
 * Слой данных дашборда.
 *
 *  store  — локальные настройки конкретного устройства (тема, токен, активное пространство).
 *  db     — общие данные, которые синхронизируются между Mac и телефоном:
 *           "cfg", "done:YYYY-MM-DD", "todo:<spaceId>". Каждая запись = { v, t },
 *           где t — время изменения. При слиянии побеждает более свежая запись.
 *  sync   — синхронизация db через приватный GitHub Gist.
 */
(() => {
  "use strict";

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("dash." + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("dash." + key, JSON.stringify(val)); } catch {} },
    del(key) { try { localStorage.removeItem("dash." + key); } catch {} },
  };

  /* ───────── db ───────── */
  let records = store.get("db", null) || migrate();

  // Перенос данных из первой версии (отдельные ключи localStorage) в db
  function migrate() {
    const r = {}, t = Date.now();
    const oldDone = store.get("done", {});
    for (const [day, v] of Object.entries(oldDone)) if (v.length) r["done:" + day] = { v, t };
    const oldCfg = store.get("cfg", null);
    if (oldCfg) {
      if (oldCfg.github?.token) store.set("token", oldCfg.github.token);
      const { github = {}, ...rest } = oldCfg;
      r.cfg = { v: { ...rest, github: { username: github.username || "" } }, t };
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("dash.todo.")) r["todo:" + k.slice(10)] = { v: JSON.parse(localStorage.getItem(k)), t };
      }
    } catch {}
    store.set("db", r);
    return r;
  }

  const listeners = new Set();
  const db = {
    get(key, fallback) { const r = records[key]; return r && r.v != null ? r.v : fallback; },
    set(key, v) {
      records[key] = { v, t: Date.now() };
      store.set("db", records);
      sync.schedule();
    },
    keys(prefix) { return Object.keys(records).filter((k) => k.startsWith(prefix)); },
    onRemoteChange(fn) { listeners.add(fn); },
  };

  /* ───────── sync via GitHub Gist ───────── */
  const FILE = "dashboard-sync.json";
  const API = "https://api.github.com";
  const token = () => store.get("token", "") || window.DASHBOARD_CONFIG?.github?.token || "";

  async function gh(path, opts = {}) {
    const r = await fetch(API + path, {
      cache: "no-store", // never use a cached copy: a stale read would overwrite newer data from the other device
      ...opts,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token()}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!r.ok) {
      const err = new Error(r.status === 401 ? "invalid token" : r.status === 403 || r.status === 404 ? "the token has no Gists access" : "GitHub " + r.status);
      err.status = r.status;
      throw err;
    }
    return r.json();
  }

  // All sync gists of this account, oldest first. The oldest one is the shared ("canonical") gist.
  async function listSyncGists() {
    const found = [];
    for (let page = 1; page <= 5; page++) {
      const list = await gh(`/gists?per_page=100&page=${page}`);
      for (const g of list) if (g.files && g.files[FILE]) found.push({ id: g.id, created: g.created_at, owner: g.owner && g.owner.login });
      if (list.length < 100) break;
    }
    return found.sort((a, b) => a.created.localeCompare(b.created));
  }

  async function findOrCreateGist(force) {
    let id = store.get("gistId", "");
    // Re-check now and then: if two devices ever created separate gists, both converge on the oldest one
    const rescan = force || !id || Date.now() - store.get("gistScan", 0) > 10 * 60 * 1000;
    if (!rescan) return id;
    const all = await listSyncGists();
    store.set("gistScan", Date.now());
    sync.info = { owner: all[0]?.owner || store.get("owner", ""), gists: all.length };
    if (all.length) {
      const canonical = all[0].id;
      // Pull in anything that only reached a duplicate gist
      for (const g of all.slice(1)) {
        try { mergeIn(await readGist(g.id)); } catch {}
      }
      if (id && id !== canonical) try { mergeIn(await readGist(id)); } catch {}
      id = canonical;
    } else id = "";
    if (!id) {
      const g = await gh("/gists", { method: "POST", body: JSON.stringify({
        description: "Dashboard sync (do not delete — holds your dashboard data)",
        public: false,
        files: { [FILE]: { content: JSON.stringify({ version: 1, records: {} }) } },
      }) });
      id = g.id;
    }
    store.set("gistId", id);
    sync.info = { ...(sync.info || {}), id };
    return id;
  }

  // Last-write-wins merge of remote records into local ones; returns true if anything changed locally
  function mergeIn(remote) {
    let pulled = false;
    for (const [k, r] of Object.entries(remote || {})) {
      if (r && (!records[k] || r.t > records[k].t)) { records[k] = r; pulled = true; }
    }
    if (pulled) { store.set("db", records); pendingNotify = true; }
    return pulled;
  }
  let pendingNotify = false;

  async function readGist(id) {
    const g = await gh(`/gists/${id}`);
    const f = g.files[FILE];
    if (!f) return {};
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    try { return JSON.parse(text).records || {}; } catch { return {}; }
  }

  const sync = {
    state: "off",       // off | syncing | ok | error
    message: "",
    last: store.get("lastSync", 0),
    busy: false,
    again: false,
    timer: null,
    onStatus: () => {},

    enabled() { return !!token() && store.get("syncOn", true); },
    setStatus(state, message = "") { this.state = state; this.message = message; this.onStatus(); },

    schedule(delay = 1500) {
      if (!this.enabled()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), delay);
    },

    async run() {
      if (!this.enabled()) { this.setStatus("off"); return; }
      if (this.busy) { this.again = true; return; }
      this.busy = true;
      this.setStatus("syncing");
      try {
        let id = await findOrCreateGist(), remote;
        try { remote = await readGist(id); }
        catch (e) { if (e.status !== 404) throw e; store.del("gistId"); id = await findOrCreateGist(); remote = await readGist(id); }

        mergeIn(remote);
        let push = Object.entries(records).some(([k, r]) => !remote[k] || r.t > remote[k].t);
        if (push) {
          // Read again right before writing so a change from the other device made a moment ago isn't overwritten
          const fresh = await readGist(id);
          mergeIn(fresh);
          push = Object.entries(records).some(([k, r]) => !fresh[k] || r.t > fresh[k].t);
        }
        if (pendingNotify) { pendingNotify = false; listeners.forEach((fn) => fn()); }
        if (push) {
          await gh(`/gists/${id}`, { method: "PATCH", body: JSON.stringify({
            files: { [FILE]: { content: JSON.stringify({ version: 1, records }, null, 1) } },
          }) });
        }
        this.last = Date.now();
        store.set("lastSync", this.last);
        this.setStatus("ok");
      } catch (e) {
        this.setStatus("error", e.message || "offline");
        if (e.status === 401) window.Dash.onAuthError?.();
      } finally {
        this.busy = false;
        if (this.again) { this.again = false; this.schedule(300); }
      }
    },

    reset() { store.del("gistId"); store.del("gistScan"); },
    info: null,
    async check() { await findOrCreateGist(true); return this.run(); },
  };

  // Синхронизируемся при открытии, при возврате в приложение, раз в минуту и при появлении сети
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync.schedule(200); });
  window.addEventListener("online", () => sync.schedule(200));
  setInterval(() => { if (document.visibilityState === "visible") sync.schedule(0); }, 60 * 1000);

  window.Dash = { store, db, sync, token };
})();
