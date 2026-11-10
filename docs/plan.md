# UniSZA Interactive Calendar — Plan (simplified, agreed 10 Nov 2026)

Source: `unija-info/file/PINDAAN RUMUSAN KALENDAR 2026_2027.pdf` (Diploma + Sarjana Muda, Sesi 2026/2027).
Reference UI: bilauitmcuti.com (month grid + filters). Single track, BM-first, multilingual-ready.

## Decisions locked
- Single view, 3 tier filters only: Pendek / Pertama / Kedua. No Diploma/Degree split in UI; schema keeps nullable `program` for future.
- BM-first; every text field has `*_ms` + `*_en` (EN stubbed in v1).
- JSON truth: `online/data/calendar.json` is the database. No Neon data tables in v1/v2.
- Routing: new app isolated in `online/`, public page at `/kalendar`. Vercel project `unija-info.vercel.app` Root Directory → `online/`. Legacy `file/kalendar_akademik.html` + `file/rumusan_kalendar_akademik.html` untouched.
- Holidays: CATATAN dates stay as `nota_ms` text in v1. Full Terengganu holiday layer + source credit deferred.
- ICS / Add to Google/Apple Calendar deferred.
- Admin: Phase 2, Google OAuth, env-var allowlist (`ADMIN_EMAILS`), one publish API. Phase 1 edits JSON by hand + redeploy.

## Phase 1 — Data + public page (build now)
Scope: `online/` app shell, `online/data/calendar.json`, `/kalendar` viewer, Vercel wiring.
- [x] Scaffold `online/` (static, no DB): `data/calendar.json`, `/kalendar` route, shared layout/styles.
- [x] Transcribe Pindaan PDF → JSON events: `id, semester, type, title_ms, title_en, start, end, nota_ms, nota_en, program (null)` — 20 events, validated locally.
- [x] Render month grid (Jun 2026 → Sep 2027 range), tier filter + type filter, today marker + phase label — verified over local server (200s).
- [x] BM-first copy; EN keys present but UI toggle hidden.
- [ ] Set Vercel Root Directory to `online/`, confirm `/kalendar` live, root still serves legacy pages. (OWNER STEP — see note below.)
- [ ] Verify date-for-date against PDF; mobile check; no console errors.

## Phase 1b — Minggu Kuliah computed weeks (done 10 Nov 2026)
- [x] `weekOf()` chunks each kuliah range into 7-day weeks from `start + week_offset_days`; offset 0 on all 5 blocks.
- [x] Verified: 8/8 week-math cases pass (boundaries, offset shift, non-kuliah null).

## Phase 1d — continued weeks + day-spanning containers (done 10 Nov 2026)
- [x] `week_start` per kuliah block (Sesi 1 = 1, Sesi 2 = 8); pill/popup/today-card inherit.
- [x] Explicit 14-week registry: `weeks` entries (spans) across 5 kuliah blocks; lookup-first, computed+clamped fallback.
- [x] Containers span kuliah days only (Apr 16–17 render as plain cuti cells); partial weeks (5-day W7s) verified.
- [x] W15 overflow resolved per official Jun column: W14 kedua = Jun 6–17 single span.

## Phase 1e — academic weeks Sun–Thu, Fri/Sat excluded (done 10 Nov 2026)
- [x] Registry rebuilt on 5-day academic weeks (Terengganu weekend); Fri/Sat never carry a week (app + fallback guarded).
- [x] Verified: 4 blocks × exactly 35 academic days (7×5); last block 40 days with W14 doubled (Jun 6–10 + Jun 13–17).
- [x] 19/19 assertions pass; group containers now always span Sun–Thu runs.

## Phase 2 — Admin (built 10 Nov 2026, owner verification pending)
- [x] `online/api/lib/session.js` — HMAC sessions, allowlist; `lib/weeks.js` — validation + weeks regen (JS port; reproduces registry byte-for-byte).
- [x] `online/api/auth.js` — Google login/callback/logout/me; `online/api/publish-calendar.js` — validate + regen + GitHub commit. Zero npm deps.
- [x] `online/admin/` editor — login gate, 20-row table, add/edit modal, delete, publish button, BM-first.
- [x] Tests: session round-trip/tamper, regen==registry, validation rejects, publish 401/400/happy-path, auth me — ALL PASS. Admin assets serve 200 (`/api/*` only runs on Vercel, not local server).
- [ ] OWNER: push to GitHub, confirm Vercel deploy; test login (allowlisted in, other Gmail rejected); supervised no-op publish; supervised real edit.

## Phase 3 — Future (deferred)
- [ ] ICS subscribe (`/unisza.ics`) + per-event Add to Calendar buttons (`Asia/Kuala_Lumpur`).
- [ ] Terengganu holiday overlay as separate `holidays[]` layer + attribution footer.
- [ ] EN toggle, past-session archive.

## Open items
- Confirm Semester Pendek display note (Diploma-heavy rows shown to all, no badge in v1 — revisit if confusion reported).
- Holiday credit source site TBD (later discussion).
