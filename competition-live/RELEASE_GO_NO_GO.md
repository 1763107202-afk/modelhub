# MOVE.ARENA V8 · Go/No-Go Release and Rollback

Status: **Not approved for production.** Demo browser QA and ephemeral PostgreSQL migration QA passed on GitHub Actions. Supabase staging API, multiple mobile clients, and organizer approval are still required.

## Change inventory
- `competition-live/index.html`: score and elapsed-time capture and projection UI.
- `competition-live/ranking.js`: ranking sort by score DESC, completion elapsed_ms ASC, manual tie_order ASC.
- `competition-live/migrations/20261107_elapsed_time_v8_STAGING_ONLY.sql`: additive elapsed fields, score-write RPC replacement, award boundary checks, reset support.
- `.github/workflows/competition-live-qa.yml`: local-only browser QA.
- `.github/workflows/competition-live-db-qa.yml`: temporary PostgreSQL 17 integration QA.

## Evidence
- Browser QA: https://github.com/1763107202-afk/modelhub/actions/runs/42378118323
- Ephemeral PostgreSQL 17: https://github.com/1763107202-afk/modelhub/actions/runs/42378911792
- Draft review: https://github.com/1763107202-afk/modelhub/pull/28

## Blocking pre-release work
1. Confirm organizers approve **score first; shorter official elapsed time breaks ties** in the public competition rules, including start and finish definitions, timeout penalties and DNF behavior.
2. Validate with an *independent Supabase staging environment*, not the lab production project. Run precisely the proposed migration and exercise `/rest/v1/rpc/comp26_action`, `comp26_reset`, read policies, role boundaries, timeout and audit behavior with synthetic fixtures.
3. Exercise A phone + B phone + 1920×1080 projector simultaneously, including reconnects, browser reloads, clock drift, manual override and corrected scores.
4. Back up production schema/data and capture a restoration point for `comp26_events`, `comp26_teams`, `comp26_tokens`, `comp26_audit` and `comp26_reset_snapshots` using an approved privileged method; DO NOT export or commit token hashes or personal data to this repo.
5. Record existing non-null score count and deal with historical results lacking `elapsed_ms`. Never invent timings. Published official outcomes should be governed by documented adjudication.
6. Coordinate the API+frontend release in a single maintenance window. The new RPC requires elapsed time on `submit` and will reject old frontend clients; the new frontend requires the new RPC. A static GitHub Pages `main` merge may publish immediately.
7. Smoke-test public read-only board, signed-in A/B submit permissions, same-score shorter time, award cutoff checks, admin reset safeguards, browser caching and cache invalidation.
8. Record final approver, version commit, rollback owner and post-release monitoring plan.

## Rollback principles
- **Do not blindly roll back only the frontend or only the RPC**: their score-submit payloads are incompatible across versions.
- Prefer returning to a coordinated known-good frontend+RPC revision while retaining new nullable time columns (non-destructive rollback).
- Do not erase elapsed_ms or overwrite actual scores during rollback; first snapshot the current database and preserve the audit trail.
- If errors occur during the release window, stop score entry, keep the display read-only, restore the matched frontend and RPC pair, then verify with authorized staff.
- Once scores have been submitted with the new timer, any downgrade must explicitly preserve and adjudicate those times.

## Current limitations and unresolved risks
- Stopwatch state is stored per browser session and is not an authoritative server-clock measurement; refreshing or switching devices during a run requires documented operator procedure.
- Client-side stopwatch is not synchronized between different devices. One official referee should operate each lane timer, optionally cross-checking with a physical backup.
- No Supabase staging branch exists on the connected project at the time of writing. Creating one may incur charges, so do not create without cost approval.
- Existing unified six-digit access codes require separate credential risk review, ideally changing to separate, stronger secrets before opening competition controls externally.
- Ephemeral PostgreSQL testing used a *minimal synthetic replica* of the existing schema, not a copy of production data.
