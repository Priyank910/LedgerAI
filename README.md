# Ledger AI

Ledger AI is a bookkeeping app for a small Indian shop. The first shop is a tailor. It keeps income, expenses, and the running balance on the device, copies them between Android and Windows when you sign in, and answers questions about those books in English, Hindi, or Gujarati.

Daily Ledger (https://github.com/Priyank910/Daily-Ledger) is the shop's current app. This project does not change that repository. Use **Settings → Bring in Daily Ledger** (or the same control on the first screen) to copy an existing backup into Ledger AI.

## What you can do

- Record income and expenses with a date, payment, category, and note.
- See totals for a day, a month, a year, or any date range. Search and category narrow the list. The totals at the top follow the period and category.
- Export that period to PDF or CSV. PDFs embed Noto Sans, Noto Sans Gujarati, and Noto Sans Devanagari, and shape Indic text before drawing it, so Gujarati and Hindi stay readable.
- Switch the whole app, including assistant replies, between English, Hindi, and Gujarati. Money always uses ₹ and Indian grouping (lakh and crore).
- Work with no network. Android and Windows installs include the screens. Entries sit in IndexedDB until a sync succeeds.
- Sign in so the same books appear on the phone and the computer.
- Ask a question such as “how much did I spend on cloth last month?” The assistant must call a tool that reads the books. Amounts are not taken from the model’s guess. A strip under the reply shows the figures the tool returned.
- Export a full backup, restore one, and import a Daily Ledger file without dropping notes, amounts, or dates.

## Architecture

```
React screens
    │
    ├─ domain (money in paise, periods, import, backup, sync merge, AI tools)
    ├─ IndexedDB  ledger-ai / state-v1
    ├─ sync engine ── Cloudflare Worker + D1, bearer session
    └─ chat loop
           ├─ tools run on this device against the open books
           └─ LlmProvider
                 ├─ PhraseProvider   VITE_LLM_MODE=mock, no key, small phrase list
                 └─ ProxyProvider    POST /api/ai-chat on the same Worker
                                         └─ Gemini, API key only as a Worker secret
```

Amounts are integer paise. A period total is the sum of those integers.

Sync is last-write-wins on `updated_at`. If two devices save the same row at the same instant, the copy already on the server stays, so both devices end on one row. The Worker refuses a push that is not strictly newer. A delete is a tombstone (`deleted_at`) and participates in the same rule. The phone and the computer need roughly correct clocks. Each query is limited to the signed-in user id taken from the session on the server. `transactions_user_updated_idx` keeps a sync to that person’s rows.

Sign-in is email and password on the Worker. The session is a random bearer token stored in the WebView (`localStorage` key `ledger-ai-bearer`). The database stores only a SHA-256 of that token. Capacitor Android loads the app from `https://localhost`, and Tauri Windows loads it from `http://tauri.localhost` or `https://tauri.localhost`. Those origins are not the Worker’s origin, so a cookie set by the Worker would be a third-party cookie and WebViews drop it. The app sends `Authorization: Bearer` instead. CORS allows that header and does not use credentials.

The assistant never receives the whole book. The phone runs the query (`period_totals`, `list_transactions`, `balance_on`, `category_totals`) and sends the tool result back through the proxy. If a reply states a rupee amount that was not in a tool result, the app drops that sentence and keeps the tool strip.

## What is ready without accounts

With an empty `.env`, the app still records books, filters, exports, backups, imports Daily Ledger, and switches language. Sign-in, cloud copy, and live Gemini answers stay off until the values below are set.

`VITE_LLM_MODE=mock` turns on an on-device stand-in. It understands a short list of phrases (today, this month, last month, this year, last year, balance, cloth, stitching, and the same ideas in Hindi and Gujarati) and still reads totals from the books. It is for tests and for trying the screen. It is not the production assistant.

## Setup

Requirements: Node.js 22.

```bash
npm ci
cp .env.example .env
npm test
npm run dev
```

Open http://localhost:5173. On the first screen, choose a language, enter the shop name and opening cash, and start. **Try a tailor’s sample** loads practice entries so you can click through before using real books.

## Environment

Copy `.env.example`. Do not commit `.env`.

| Name | Where it is read | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | app | Absolute Worker URL, for example `https://ledger-ai.<account>.workers.dev`. Required on Android and Windows. Leave empty for `npm run dev`, which proxies `/api` to wrangler on port 8787. |
| `VITE_LLM_MODE` | app | Set to `mock` for the on-device phrase tool-caller. Leave empty in production. |
| `GEMINI_API_KEY` | Worker secret only | Google AI Studio key. Put it in `.dev.vars` for local wrangler and `wrangler secret put` for production. No `VITE_` prefix, so it is never bundled into the Android or Windows app. |
| `GEMINI_MODEL` | Worker var | Defaults to `gemini-2.5-flash` in `wrangler.toml`. |

## Cloudflare

The free plan is enough for one shop. D1 holds the users, sessions, shop profile, and transactions. One Worker serves sign-in, sync, and the Gemini proxy.

1. Create a free account at https://dash.cloudflare.com/sign-up.
2. From this repo, sign the Wrangler CLI into that account: `npx wrangler login`.
3. Create the database: `npx wrangler d1 create ledger-ai`. Copy the printed `database_id` into `wrangler.toml` in place of `00000000-0000-0000-0000-000000000000`.
4. Apply the schema locally and remotely:

```bash
npx wrangler d1 migrations apply ledger-ai --local
npx wrangler d1 migrations apply ledger-ai --remote
```

5. Copy `.dev.vars.example` to `.dev.vars` and set `GEMINI_API_KEY` for local runs. For the deployed Worker: `npx wrangler secret put GEMINI_API_KEY`.
6. Deploy: `npm run worker:deploy` (this runs `wrangler deploy`). Wrangler prints the URL, shaped like `https://ledger-ai.<account>.workers.dev`.
7. Put that exact URL in the app’s `.env` as `VITE_API_URL`, with no trailing path. Rebuild the Android and Windows apps so the URL is baked in. The Gemini key is not baked in.

Local development is two processes. `npm run worker:dev` starts the Worker on http://127.0.0.1:8787 with Miniflare and the local D1 file. `npm run dev` proxies `/api` to that port. Leave `VITE_API_URL` empty while you do this.

The Worker checks the bearer token before every sync or chat call, then reads and writes only `user_id` from that session. Chat forwards the question to Gemini with the `x-goog-api-key` header. The key is not returned to the phone.

## Import from Daily Ledger

Daily Ledger stores one JSON object under the localStorage key `daily-ledger-data-v1`, and its backup file wraps that object:

```json
{ "format": "daily-ledger-backup", "version": 1, "ledger": { "shopName": "", "openingBalance": 0, "setupDate": "2026-01-01", "transactions": [] } }
```

Ledger AI accepts the backup file, the raw object, or `{ "daily-ledger-data-v1": <object or JSON string> }`. Shop name, opening balance, setup date, and every entry’s id, type, title, amount, date, payment, and note are kept. Amounts become paise. Unknown fields are kept on `extra`. Payment names Cash, UPI, Bank transfer, and Card map to the built-in ids; any other payment text is kept as written. Category becomes `other` because Daily Ledger did not store one.

On the phone that already runs Daily Ledger: Home → Settings → Backup and restore → Export backup. Copy that file to the Ledger AI phone or PC and import it. Import replaces the books on that device and tombstones older local rows so a later sync does not bring them back. Rows that exist only in the cloud, with a newer timestamp, still merge in.

PDF and CSV reports from Daily Ledger are not backups.

## Android

Requirements on the build machine: Node.js 22, JDK 21, Android SDK 36 (platform `android-36` and build-tools `36.0.0`). `minSdk` is 24 (Android 7).

```bash
npm run android:debug
```

That builds the web app, syncs Capacitor, and runs `./gradlew assembleDebug`. The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

`ANDROID_HOME` must point at the SDK. The debug APK is signed with the debug key. A Play upload needs a release keystore that is not in this repo. The application id is `com.ledgerai.shop`, so it installs beside Daily Ledger instead of replacing it.

## Windows

The desktop shell is Tauri 2, in `src-tauri`. It packages the same React app. Bundled targets are NSIS and MSI (`src-tauri/tauri.conf.json`).

Build on Windows, where WebView2 is already part of Windows 10 and 11:

```bash
npm ci
npm run desktop:build
```

You need the Rust toolchain (https://rustup.rs) as well as Node. The installers are written under `src-tauri/target/release/bundle/`. `npm run desktop:dev` opens a window against the Vite server.

This Linux environment can hold the Tauri project and icons. It does not produce the Windows installers. Cross-compiling the Windows webview from Linux is not part of the setup.

The content security policy allows `https:` and `wss:` so the Worker URL works without editing the policy for each account. Capacitor uses `androidScheme: https`, so the phone origin is `https://localhost` and the Worker is a different host. The bearer token is how those two stay signed in.

## Tests

```bash
npm test
```

The suite covers paise and lakh formatting, day/month/year/range totals, Daily Ledger import, backup round-trip, CSV (UTF-8 BOM and formula text), last-write-wins sync, the Worker sign-in and user-scoped sync, the chat proxy (session required, key not returned), the Gemini request builder, Indic shaping for the Devanagari i-matra, and a PDF that embeds the Noto fonts. Sync, auth, and the assistant are exercised with an in-memory store and a scripted fetch. No test calls Cloudflare or Google.

## Free-tier limits for shop books

- D1’s free plan allows 5 million rows read and 100,000 rows written per day, and 5 GB stored. One shop stays far under that because each sync reads that user’s indexed rows, not the whole database. If a day does go past the limit, queries fail until the counter resets at 00:00 UTC, which is 05:30 IST. There is no inactivity pause. The books on the phone and the PC keep working offline either way. Export a backup before a long holiday.
- D1 keeps 7 days of Time Travel. From the Cloudflare dashboard you can restore the database to a point in that window. A restore replaces the live database, so do it only when the copy on the phone is also backed up.
- Workers free includes 100,000 requests a day. Sign-in, sync, and a question each count as one request.
- Gemini’s free tier in Google AI Studio can use prompts to improve Google’s products. A question, and the tool result that answers it, are sent to Google. The tool result can include amounts, titles, and notes. The rest of the book stays on the device. Read the current Gemini terms before putting real books on the free tier. A paid Gemini or Vertex route with different data terms can replace `completeWithGemini` without changing the screens. The `LlmProvider` interface is the only seam.
- `GEMINI_API_KEY` is a secret. It lives in `.dev.vars` or a Worker secret, never in the app and never with a `VITE_` prefix. The bearer token in the WebView is the person’s session. Anyone with that token can read that person’s books until it expires (30 days) or they sign out.

## What the owner needs to provide

Nothing else is billed if you stay on the free tiers above.

1. A Cloudflare account.
2. `npx wrangler login` on the machine that deploys.
3. `npx wrangler d1 create ledger-ai`, then the printed database id pasted into `wrangler.toml`.
4. `npx wrangler d1 migrations apply ledger-ai --remote` (and `--local` on the machine you develop on).
5. A Gemini API key from Google AI Studio, stored with `npx wrangler secret put GEMINI_API_KEY`. For local wrangler, the same key in `.dev.vars`.
6. `npm run worker:deploy`.
7. The printed `*.workers.dev` URL in the app’s `.env` as `VITE_API_URL`, then a rebuild of Android and Windows.
8. Optional: change `GEMINI_MODEL` in `wrangler.toml` if `gemini-2.5-flash` is not the model you want.
9. Optional, only for a Play Store or sideload update that must match a future release: an Android release keystore. Debug builds do not need it.
10. On the Windows PC used to build the installer: Rust, Node 22, and WebView2.

After those are set, rebuild the Android and Windows apps so `VITE_API_URL` is baked into that install. The Gemini key is not baked in.
