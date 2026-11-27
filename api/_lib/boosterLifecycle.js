// Pure cutoff checks; mutation is reconciled inside the persistence transaction.
function cutoff(match, now = Date.now()) {
  if (!match) return null;
  if (match.status !== 'COMPLETED' && match.selection_override === 'OPEN') return null;
  if (match.booster_locked_at) return {at:match.booster_locked_at, reason:match.booster_lock_reason || 'persisted'};
  const scheduled = Date.parse(match.match_date);
  if (Number.isFinite(scheduled) && scheduled <= now) return {at:new Date(scheduled).toISOString(), reason:'scheduled_start'};
  if (match.first_delivery_at && Date.parse(match.first_delivery_at) <= now) return {at:match.first_delivery_at, reason:'first_delivery'};
  if (match.is_locked || ['LIVE','COMPLETED'].includes(match.status)) return {at:new Date(now).toISOString(), reason:match.is_locked ? 'admin_lock' : 'match_started'};
  return null;
}
function reconcile(db, now = Date.now()) {
  for (const match of db.matches) {
    if (match.status !== 'COMPLETED' && match.selection_override === 'OPEN') continue;
    let lock = cutoff(match, now);
    // Existing score records or consumed records are authoritative legacy evidence.
    if (!lock && (db.playerMatchStats.some(s => s.match_id === match.id) || db.powerBoosterUses.some(u => u.match_id === match.id && (u.consumed_at || u.state === 'CONSUMED')))) {
      lock = {at:new Date(now).toISOString(), reason:'stored_history'};
    }
    if (!lock) continue;
    match.booster_locked_at ||= lock.at;
    match.booster_lock_reason ||= lock.reason;
    for (const use of db.powerBoosterUses.filter(u => u.match_id === match.id)) {
      use.consumed_at ||= lock.at;
      use.state = 'CONSUMED';
    }
  }
  for (const use of db.powerBoosterUses) {
    use.state ||= 'RESERVED';
    use.reservation_id ||= require('crypto').createHash('sha256').update(JSON.stringify([use.user_id,use.match_id,use.role,use.applied_at])).digest('hex');
  }
}
module.exports = {cutoff, reconcile};
