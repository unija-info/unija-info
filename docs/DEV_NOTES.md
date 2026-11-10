# DEV_NOTES.md — unija-info session checkpoints (newest first)

## Checkpoint 1 — 10 Nov 2026 (kalendar Phase 1 + admin Phase 2 built, shakedown pending)

Headspace for next-you: long build session, BM-flavored directives, user drives by
screenshots/mockups and short approvals ("go", "try 1 first"). Rhythm: propose →
verify with executed checks → preview → user reacts visually. Standing lens:
sparring partner when asked, otherwise ship. Don't re-ask settled decisions
(W-prefix, Sun–Thu weeks, clamp-14, parked items below).

What shipped (pushed through `6200f3e`):
- Phase 1: `online/data/calendar.json` (20 events from Pindaan PDFs), `/kalendar/`
  viewer (bilacuti-style, Ahad–Sabtu grid, week containers, hover/tap popups,
  dark mode, today card), `/` landing. Verified: schema/date/registry checks,
  `node --check`, local 200s, 19/19 week assertions.
- Weeks: explicit 34-entry registry, Sesi 2 continues 8–14, Sun–Thu academic
  weeks (Fri/Sat excluded), W14-kedua = Jun 6–17 clamp per official Jun column.
- Phase 2: zero-dep `online/api/` (Google OAuth + allowlist, publish with
  validation + weeks regen + GitHub commit), `/admin/` editor (all 20 events,
  BM-first). Handler tests all pass; owner confirmed live login works.
- Vercel Root Directory = `online/` (no trailing slash); deploy retriggered via
  trigger commit. Plan current in `docs/plan.md`.

Bugs + lessons:
1. `/api/*` 404 on Live Server / plain http.server — expected, static servers
   don't run functions. Never X: don't debug code for environmental 404s; always
   Y: state it before the user screenshots it.
2. `/api/*` 404 on Vercel — Root Directory was repo root. Fix: set `online/` +
   redeploy (setting needs a redeploy; docs-only pushes get skipped by
   "skip deployments if unchanged" — use a trigger commit inside `online/`).
3. `redirect_uri_mismatch` — registered path-style vs app query-style URI.
   Always Y: read the exact URI from Google's error details, register it verbatim.
4. Computed W15 overflow — resolved via explicit registry + clamp-14, never
   silent math against the official table.
5. Plan-file edits twice clobbered neighboring sections. Always Y: re-read the
   region after every plan edit.

Open threads (owner-side unless noted):
- Shakedown unverified live: no-op publish → real edit → negative test → 2nd
  admin login. First signal to ask for.
- Parked: exams/study-week weekend treatment; Terengganu holiday layer + credit;
  ICS/Google/Apple export; EN toggle; users-management page.
- `gen_weeks.py` lives in Temp (`C:\Users\darkv\AppData\Local\Temp\opencode\`),
  not in repo — fold into `online/tools/` if manual data edits continue pre-admin.
