# MOVE.ARENA · First QA Gate (2026-11-07)

Scope: `competition-live/index.html` in the shared `modelhub` monorepo.
This is a non-production acceptance gate, **not** a certificate of production readiness.

## Environments and boundaries
- Test on the GitHub PR branch, with a local loopback web server and URL `?demo=1`.
- Browser route intercept blocks all external hosts before network access; never invoke live RPC or reset real scores.
- Workflow triggers only for competition-live paths or this QA workflow. It does not deploy, merge, or update Supabase.
- Main is read-only for this stage. A PR must be reviewed before merge.
- The `?demo=1` path intentionally uses localStorage; no two-device synchronization is tested through this mode.

## Implemented automated tests
1. 1920x1080 audience view has exactly 36 rank entries and does not overflow the viewport.
2. Demo judge logs in and submits 92.50; a refreshed screen view displays it.
3. Canceling admin reset preserves scores; confirmed demo reset returns to round 1 and clears scores.
4. Demo navigation does not attempt calls to Supabase REST.

## Important limitations / release blockers
- This PR is **tests only**. It does not modify application behavior or database policies.
- Live two-device propagation, latency, judge role separation, 18-round transitions, fault/retry, tie-boundary decisions and prize counts need **isolated staging Supabase project** tests before production release.
- Application currently uses a shared six-digit role-selectable code. Never publish or paste live secrets to CI.
- Publicly callable SECURITY DEFINER RPCs are flagged by Supabase advisors; independently audit server-side checks, code hashing, rate limits, audit logs and permissions. Do not blindly revoke privileges, as live clients depend on these RPCs.
- Reset RPC must enforce phase guard and role checks at the database layer. Frontend confirmation alone is not sufficient.
- On the shared GitHub Pages monorepo, merging to `main` may publish static files immediately. Do not merge without explicit authorization and a preflight backup.

## Manual pre-release checklist (staging only)
- [ ] 2 real mobile judge clients and 1 1920x1080 projector client sync within measured budget.
- [ ] Judge A cannot update judge B; neither can reach admin actions.
- [ ] Server rejects unauthorized calls, invalid score values and duplicate phase transitions.
- [ ] Tie-boundary positions 3/4, 10/11 and 18/19 are resolved as documented.
- [ ] Fault -> one retry -> review, including no-second-retry case.
- [ ] Awards 3 / 7 / 8 only after all 36 scores approved; visible on all screens.
- [ ] Reset rejected after awards, and every reset has an independently verified snapshot.
- [ ] Offline/reconnect does not erase unsubmitted judge input or silently duplicate submissions.
- [ ] Snapshot current commit and database backup, document rollback process, have human approve publish.

## Run
```bash
npm install --no-save --ignore-scripts @playwright/test@1.56.1
npx playwright install chromium
npx playwright test --config=competition-live/playwright.config.cjs
```
