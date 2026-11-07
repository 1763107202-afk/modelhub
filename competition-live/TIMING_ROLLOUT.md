# MOVE.ARENA V8: independent lane timers and score-first tie-break ranking

## Confirmed behavior
- Judge A and Judge B see independent team-specific stopwatches. Start/stop/reset are explicit actions.
- Elapsed time uses centisecond precision and is stored as integer milliseconds (`elapsed_ms`, multiples of 10).
- Ranking is: score descending > completion elapsed time ascending > manually adjudicated order ascending > draw order for deterministic display.
- Times are not counted as extra points: a lower score never beats a higher score merely by finishing faster.
- Missing elapsed time never counts as zero seconds; timed records rank above missing-time records within equal scores.
- Manual time entry is supported with mandatory reason in judge note.
- Double-save and reset are deliberate confirmation operations. Timing persists in the tab session across a refresh and switching screens.
- DNF remains a distinct status; zero score does not automatically imply a valid elapsed time.

## Current limitations / required follow-up
- This is **proposed**, not activated in the production database. Its matching SQL migration is `migrations/20261107_elapsed_time_v8_STAGING_ONLY.sql`.
- Migration adds elapsed fields and changes server-side `comp26_action` and `comp26_reset` logic. It is intentionally **not** run against your connected production Supabase project.
- The migration rejects old clients without elapsed values. Thus database and static page must be coordinated during a maintenance window with a rollback and backup.
- Existing scores from before the migration have no elapsed value and must be manually reviewed or re-entered on staging; do not invent times.
- Stopping a browser stopwatch is an operational measurement, not tamper-proof or synchronized timekeeping; a true authoritative timing system requires server timestamps or independent hardware timing.
- Two phone clients on the same lane are not a synchronized stopwatch. Use one official timing operator per lane.
- Exact award boundaries 3/4, 10/11 and 18/19 require server-side checks consistent with the frontend.
- Existing uniform 6-digit credential setup still merits independent security hardening; do not reuse real codes in tests.
- The score-first/timed approach must be approved in the published competition rulebook before using it to award prizes.

## Test gate
- PR branch acceptance exercises audience 36 team layout, demo scoring, stopwatch stop-before-submit, demo-only reset, score/time tie breaks and remote API isolation.
- Isolated Supabase staging project must run the migration and verify `submit`, `next`, `retry`, `reveal`, `reset`, role isolation, audit and snapshot behavior.
- Do not merge to `main` or deploy to production until staged end-to-end tests pass and the competition organizers approve the tie-break policy.
