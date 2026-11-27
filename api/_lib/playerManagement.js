const { fail, text, integer, deadline } = require('./validation');
const clone = value => JSON.parse(JSON.stringify(value));
const state = db => db.playerManagement ||= { revision: 0, history: [] };
const locked = (db, m) => deadline(m) || db.playerMatchStats.some(s => Number(s.match_id) === Number(m.id));
const selected = (db, id, matchId) => db.fantasyTeams.some(t => Number(t.match_id) === matchId && t.player_ids.includes(id));
function view(db) {
  return { players: db.players, matches: db.matches.map(m => ({ id: m.id, title: m.title })),
    revision: state(db).revision, can_undo: state(db).history.length > 0,
    editable: true, availability_editable: true, eligibility_editable: true,
    locked_matches: db.matches.filter(m => locked(db, m)).map(m => m.id),
    eligibility_locks: Object.fromEntries(db.players.map(p => [p.id, db.matches.filter(m => locked(db, m) || ((p.match_eligibility || []).includes(m.id) && selected(db, p.id, m.id))).map(m => m.id)])) };
}
function save(db, body, actor, undoing = false) {
  const meta = state(db);
  if (body.revision !== meta.revision) throw Object.assign(Error('The player list changed. Refresh before saving your edits.'), { status: 409 });
  if (!Array.isArray(body.players) || !body.players.length || body.players.length > 1000) fail('Submit between 1 and 1000 players.');
  const current = new Map(db.players.map(p => [p.id, p]));
  let nextId = Math.max(0, ...current.keys()) + 1;
  const ids = new Set();
  const normalized = body.players.map(input => {
    if (!input || typeof input !== 'object') fail('Invalid player record.');
    const id = input.id == null ? nextId++ : integer(input.id, 'Player ID', 1, Number.MAX_SAFE_INTEGER);
    if (ids.has(id)) fail('Duplicate player ID.');
    ids.add(id);
    const previous = current.get(id);
    if (input.id != null && !previous) fail('New players must omit their internal ID; the server generates it.');
    const name = text(input.name, 'Player name', 2, 80);
    if (!['PAK', 'SL'].includes(input.team)) fail(`${name}: invalid cricket team.`);
    if (!['WK', 'BAT', 'AR', 'BOWL'].includes(input.role)) fail(`${name}: invalid fantasy role.`);
    if (!Array.isArray(input.match_eligibility) || input.match_eligibility.some(id => !Number.isSafeInteger(id) || !db.getMatchById(id))) fail(`${name}: invalid match eligibility.`);
    const eligibility = [...new Set(input.match_eligibility)].sort((a,b) => a-b);
    for (const match of db.matches) {
      const matchId = match.id;
      const before = (previous?.match_eligibility || []).includes(matchId);
      const after = eligibility.includes(matchId);
      if (before !== after && locked(db, match)) fail(`${name}: Match ${matchId} is locked, completed, or has saved score records. Its eligibility cannot change.`);
      if (before && !after && selected(db, id, matchId)) fail(`${name}: cannot remove Match ${matchId} eligibility because the player is already in a saved fantasy team.`);
    }
    const availability_status = input.availability_status || 'AVAILABLE';
    if (!['AVAILABLE','MONITORING','OUT'].includes(availability_status)) fail('Invalid availability status.');
    if (input.active != null && typeof input.active !== 'boolean') fail('Active status must be true or false.');
    const photo_url = input.photo_url ? text(input.photo_url, 'Photo URL', 1, 2048) : null;
    if (photo_url) { try { if (new URL(photo_url).protocol !== 'https:') fail('Use an HTTPS photo URL.'); } catch { fail('Use a valid HTTPS photo URL.'); } }
    return { ...(previous || {}), id, name, team: input.team, role: input.role,
      country: input.team === 'PAK' ? 'Pakistan' : 'Sri Lanka', wicketkeeper: input.role === 'WK',
      match_eligibility: eligibility, availability_status, active: input.active !== false, photo_url,
      external_player_id: input.external_player_id == null || input.external_player_id === '' ? null : text(String(input.external_player_id), 'External player ID', 1, 80),
      availability_note: input.availability_note ? text(input.availability_note, 'Availability note', 1, 240) : null,
      last_updated: new Date().toISOString() };
  });
  if (db.players.some(p => !ids.has(p.id))) fail('Existing players cannot be deleted. Deactivate them instead.');
  // Capture the pre-edit roster lazily, before the first global edit affecting history.
  // Full snapshots also protect inactive players and empty historical rosters.
  for (const m of db.matches) if (locked(db, m) && !m.player_snapshot) m.player_snapshot = clone(db.players);
  if (!undoing) meta.history = [...meta.history, { players: clone(db.players), actor, at: new Date().toISOString() }].slice(-10);
  db.players = normalized;
  meta.revision++;
}
function undo(db, body, actor) {
  const last = state(db).history.at(-1);
  if (!last) fail('There is no player edit to undo.');
  const old = new Map(last.players.map(p => [p.id, p]));
  const players = db.players.map(p => {
    const target = clone(old.get(p.id) || { ...p, active: false, match_eligibility: [] });
    // Newly locked/selected matches retain their current eligibility during undo.
    target.match_eligibility = db.matches.filter(m => (locked(db,m) || selected(db,p.id,m.id)) ? p.match_eligibility.includes(m.id) : target.match_eligibility.includes(m.id)).map(m => m.id);
    return target;
  });
  save(db, { players, revision: body.revision }, actor, true);
  state(db).history.pop();
}
module.exports = { view, save, undo };
