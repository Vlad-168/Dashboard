# Dashboard — macOS desktop + iPhone

A private personal dashboard: greeting and clock, training schedule, coaching lessons,
tournaments, GitHub tasks, to‑dos and a focus timer. Separate **spaces**
(Work / Training / Coaching / Personal), **6 themes** led by **Damson `#854C65`**,
and subtle **3D & motion** (card tilt with glare, parallax background, 3D gyroscope,
count‑ups, confetti) that respects *Reduce Motion*.

## Install

### Mac — as your desktop
1. Install the free **[Plash](https://apps.apple.com/app/plash/id1494023538)** app.
2. Plash → *Add Website* → your dashboard URL.
3. Turn on **Browsing Mode** in Plash to click on it (assign a shortcut in Plash settings).

<details><summary>Offline alternative: local server</summary>

```bash
./scripts/install-macos.sh     # http://localhost:8787, starts at login
./scripts/uninstall-macos.sh   # remove
```
</details>

### iPhone — as an app
1. Open the dashboard URL in **Safari**.
2. Share → **Add to Home Screen**.
3. Open it from the icon and paste your GitHub token.

### iPhone — home screen widget
Settings → **iPhone widget** → *Copy widget script*, paste it into a new script in the free
**[Scriptable](https://apps.apple.com/app/scriptable/id1405459188)** app, run it once to save your
token, then add a Scriptable widget (small / medium / large) and pick the script.
Source: [`widget/dashboard-widget.js`](widget/dashboard-widget.js).

## Using it

- **Spaces** — tabs at the top (Mac: keys `1`–`9`) or the bottom bar on iPhone; swipe between them.
- **Add** training, lessons and tournaments with **+** on their cards. Pick several days at once.
- **Edit** — tap any session in *Today* or in the week strip: mark it done, change it or delete it.
- **Coaching** — past lessons count as done automatically, so only mark cancellations.
  Stats show lessons, hours on court, earnings and forecast, tennis vs padel.
- **Tournaments** show up in your weeks and greeting. If lessons clash with one, the card warns
  you and cancels them in one tap.
- Durations: 1 h / 1.5 h / 2 h (30 min for short training).

## Groshkov Padel bot

Bookings from the Telegram bot show up in **Coaching** next to your weekly lessons (🤖), read‑only:
clients, dates and times, format, duration, location (with map) and court type; your price per lesson
computed with the bot’s rules (format × people × duration, subscriptions) and court fees per
location / time; booking requests waiting for confirmation are highlighted and counted in the greeting.

Connect it in Settings → Coaching with the bot’s Firebase **project ID** and **web API key**. They are
kept in your private sync, not in this repository. Only the needed fields are read (no Telegram ids).
The iPhone widget shows these bookings too. Manage bookings in the bot itself.

## Instagram 📸

The **Instagram** space shows @groshkov.padel: followers with 7/30‑day growth, reach, views and engagement
for the last 7 days, a 30‑day chart (reach, new followers, followers) and recent posts sorted by date or
reach. Data comes from the bot’s API worker (`GET /instagram`, same URL and key as Coaching); the Instagram
token is stored and renewed on the worker. Setup: Settings → Instagram, and the bot’s SECURITY.md → Instagram.

## Settings (⚙︎ or `,`)

Sidebar sections: **Profile**, **Appearance** (themes, animations & 3D), **GitHub**, **Sync**,
**Coaching** (bot connection, currency), **Instagram**, **iPhone widget**, **Spaces** (advanced JSON), **Account** (log out).

### GitHub token
github.com → Settings → Developer settings → **Fine‑grained tokens**:
Repository permissions *Issues: Read*, *Pull requests: Read*;
Account permissions **Gists: Read and write** (needed for sync).

## Sync & privacy

- Without a token on the device the site shows **only a lock screen**.
- Your data (training, players, prices, tournaments, tasks) is never in this repository. It lives
  on your devices and in a **secret Gist** that only your token can read. Sync runs on open, when
  you come back to the app, every minute and right after each change; it works offline too.
- Search engines are blocked (`robots.txt`, `noindex`).
- For full privacy, host it on Cloudflare Pages behind Cloudflare Access (email one‑time code).

## Shortcuts (Mac)
| Key | Action |
|---|---|
| `1`…`9` | switch space |
| `T` | next theme |
| `,` | settings |
