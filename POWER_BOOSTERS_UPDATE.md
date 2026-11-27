# Five boosters: lock-time consumption

Each user has BAT, BOWL, AR, WK and 3X once per series. One confirmed booster per match. Choosing a card alone does not reserve it: save an eligible XI and confirm first.

- AVAILABLE → RESERVED → CONSUMED.
- Before lock, cancel a reservation and choose the same or a different available booster. The XI remains saved.
- Scheduled start, an explicit admin lock, recorded LIVE/COMPLETED status or authoritative first-delivery evidence closes all lineup editing. The earliest established cutoff is irreversible.
- The entire team panel freezes: players, captain, vice-captain and booster. Admin unlock, activate and reschedule requests cannot reopen a locked fixture.
- Consumption does not remove the booster from that match's scoring. It stays applied through live scoring, finalization and later corrections, but cannot be selected for another match.
- No-result keeps the existing zero-points policy, without refunding the booster. Rain delays do not automatically refund anything.
- The explicit, confirmed full-tournament RESET operation clears teams, scores and booster inventory. It starts over; it is not an unlock mechanism.

| Player | Multiplier |
|---|---|
| Ordinary | 1× |
| Captain | 2× |
| Vice-captain | 1.5× |
| Role-boosted ordinary player | 2× |
| Role-boosted captain | 4× |
| Role-boosted vice-captain | 3× |
| 3X target (cannot be captain or vice-captain) | 3× |

Negative base points use the same multipliers. Score corrections recalculate from base points rather than multiplying the previous total.

## Persistence and API

Additive schema version 6 retains existing account, match, player and team IDs. Uses gain state, reservation_id and consumed_at; matches gain booster_locked_at and booster_lock_reason. Existing reservations are migrated under the existing serialized transaction. Scheduled/started/locked/scored matches consume their recorded reservations. Unknown historical events cannot be reconstructed: a booster already canceled and deleted by the old version is not silently recreated.

GET /api/power-boosters?match_id=N returns uses, counts, current reservation, verified cancellation permission and the user's match-by-match points/history. POST apply retains the saved-lineup revision check and idempotent replay. POST cancel requires match_id and the current reservation_id, so a stale browser tab cannot cancel a newer reservation. Old cached clients should reload after deployment.

Read-triggered deadline reconciliation is committed before a successful response. Reads and writes share the Redis lease and compare-and-set commit; failed writes return 503 and roll back. This prioritizes game integrity and may add Redis latency; no backend speed claim is made. Inactive/disabled fixtures cannot accept booster changes.

No ball-by-ball feed is fabricated. The optional score display does not supply authoritative first-delivery events. Scheduled deadlines and manual admin locks work without a provider; the lifecycle can also consume a stored authoritative first_delivery_at if an integration supplies it later.
