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
    ├─ sync engine ── Supabase Auth + Postgres, row level security
    └─ chat loop
           ├─ tools run on this device against the open books
           └─ LlmProvider
                 ├─ PhraseProvider   VITE_LLM_MODE=mock, no key, small phrase list
                 └─ ProxyProvider    POST to the dev server or the Supabase edge function
                                         └─ Gemini, API key only on the server
```

Amounts are integer paise. A period total is the sum of those integers.

Sync is last-write-wins on `updated_at`. If two devices save the same row at the same instant, the copy already on the server stays, so both devices end on one row. A delete is a tombstone (`deleted_at`) and participates in the same rule. The phone and the computer need roughly correct clocks. The full book is small for one shop, so each sync reads the person’s rows and uploads only the rows this device won.

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
| `VITE_SUPABASE_URL` | app | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | app | Supabase anon key. It is public. Row Level Security limits each person to their own rows. Never put the service-role key in the app. |
| `VITE_AI_PROXY_URL` | app | Optional. Leave empty to call the Supabase function `ai-chat` after sign-in. Set it only if the proxy lives somewhere else. |
| `VITE_LLM_MODE` | app | Set to `mock` for the on-device phrase tool-caller. Leave empty in production. |
| `GEMINI_API_KEY` | dev server and edge function only | Google AI Studio key. No `VITE_` prefix, so Vite does not put it in the Android or Windows bundle. |
| `GEMINI_MODEL` | dev server and edge function | Defaults to `gemini-2.5-flash`. |

`npm run dev` exposes `POST /api/ai-chat` on the machine running Vite. That route reads `GEMINI_API_KEY` and forwards the chat to Gemini. A production build does not include that route.

## Supabase

1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/20260321000000_ledger.sql`.
3. Authentication → Providers → Email. For a family shop, turn off “Confirm email” so the first sign-in does not wait on an inbox. If you leave it on, the app tells the person to confirm, then sign in.
4. Deploy the edge function in `supabase/functions/ai-chat`:

```bash
supabase secrets set GEMINI_API_KEY=your-key
supabase functions deploy ai-chat
```

The function checks the signed-in user’s token, then calls Gemini. It does not read the ledger tables. Set `GEMINI_MODEL` the same way if you want a different model.

5. Put the project URL and anon key in `.env`, rebuild, and install that build on the phone and the PC.

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

The content security policy allows `https:` and `wss:` so a Supabase project URL works without editing the policy for each project.

## Tests

```bash
npm test
```

The suite covers paise and lakh formatting, day/month/year/range totals, Daily Ledger import, backup round-trip, CSV (UTF-8 BOM and formula text), last-write-wins sync, the chat tool loop (including a rejected invented total), the Gemini request builder, Indic shaping for the Devanagari i-matra, and a PDF that embeds the Noto fonts. Sync and the assistant are exercised with an in-memory transport and a scripted provider. No test calls Supabase or Google.

## Free-tier limits for shop books

- A free Supabase project pauses after about a week with no activity. The books on the phone and the PC keep working. The next sync waits until the project wakes, which can take a few minutes. Export a backup before a long holiday. Unpausing is done from the Supabase dashboard.
- Free-project database size, file storage, and egress have quotas. One shop’s ledger is small. Don’t attach photos or other large files later without checking the quota.
- Gemini’s free tier in Google AI Studio can use prompts to improve Google’s products. A question, and the tool result that answers it, are sent to Google. The tool result can include amounts, titles, and notes. The rest of the book stays on the device. Read the current Gemini terms before putting real books on the free tier. A paid Gemini or Vertex route with different data terms can replace `completeWithGemini` without changing the screens. The `LlmProvider` interface is the only seam.
- The anon key is not a secret. The service-role key and `GEMINI_API_KEY` are. They stay in Supabase secrets or in `.env` on your computer.

## What the owner needs to provide

Nothing else is billed if you stay on the free tiers above.

1. A Supabase account, a project URL, and that project’s anon key.
2. The SQL in `supabase/migrations/20260321000000_ledger.sql` applied to that project.
3. The `ai-chat` edge function deployed from `supabase/functions/ai-chat`.
4. A Gemini API key from Google AI Studio, stored as the Supabase secret `GEMINI_API_KEY` and, for `npm run dev` only, in `.env`.
5. Optional: `GEMINI_MODEL` if `gemini-2.5-flash` is not the model you want.
6. Optional, only for a Play Store or sideload update that must match a future release: an Android release keystore. Debug builds do not need it.
7. On the Windows PC used to build the installer: Rust, Node 22, and WebView2.

After those are set, rebuild the Android and Windows apps so the URL and anon key are baked into that install. The Gemini key is not baked in.
