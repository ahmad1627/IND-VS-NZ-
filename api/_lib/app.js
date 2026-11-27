require('./config');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { router: authRouter, authMiddleware, adminMiddleware, optionalAuthMiddleware } = require('./auth');
const { persistence, hasRedis } = require('./persistence');
const { calculatePlayerFantasyPoints, calculateTeamPoints, playerMultiplier } = require('./scoringEngine');
const { deadline, integer } = require('./validation');
const rateLimit = require('./rateLimit');

const app = express();

// ==========================================
// CORS & Middleware Configuration
// ==========================================
// The deployed React frontend and API use the same Vercel domain. Cross-origin
// access is needed only when developing locally with Vite on port 5173.
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.disable('x-powered-by');
app.use(express.json({limit:'256kb'}));
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','no-store');next();});

// Optional local AI, isolated from serialized game state.
app.post('/api/ai-recommend', require('./aiLocal'));

// Provider latency is isolated from the serialized game-state request queue.
const liveScores = require('./liveScores').createLiveScores({ key: process.env.CRICKET_API_KEY, redis: require('./persistence').redis });
app.get(['/api/live-scores', '/live-scores'], async (req, res) => res.json(await liveScores()));

// Helper for formatting lock info
function formatMatchLockInfo(m) {
  const isSelectable = Boolean(m.is_active && !deadline(m) && !m.team_selection_disabled && m.status !== 'COMPLETED');
  let statusBadge = 'LOCKED_FUTURE';
  let lockStatusText = 'Selection opens before scheduled start';
  const dateObj = new Date(m.match_date);
  const dateStr = dateObj.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: m.local_timezone || 'Asia/Qatar' });
  if (m.status === 'COMPLETED') {
    statusBadge = 'COMPLETED';
    lockStatusText = 'Match completed — points finalized';
  } else if (deadline(m)) {
    statusBadge = 'LOCKED_1ST_BALL';
    lockStatusText = 'Lineup locked — match start reached or admin lock';
  } else if (m.team_selection_disabled) {
    statusBadge = 'PENDING';
    lockStatusText = 'Selection opens after administrator verifies final qualification';
  } else if (m.is_active) {
    statusBadge = 'OPEN';
    lockStatusText = m.selection_override === 'OPEN' ? 'Selection reopened by admin — open until admin locks again' : 'Open for daily team selection until match start';
  } else {
    statusBadge = 'LOCKED_FUTURE';
    lockStatusText = `Selection unavailable (${dateStr})`;
  }
  return { isSelectable, statusBadge, lockStatusText };
}

// Router for all API routes (mounted at both root and /api for maximum compatibility)
const apiRouter = express.Router();

// Mount Auth
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', require('./admin'));

// ==========================================
// FIXTURES & MATCH ROTATION ENDPOINTS
// ==========================================

apiRouter.get('/matches', (req, res) => {
  const matches = db.getMatches();
  const formatted = matches.map(m => {
    const { isSelectable, statusBadge, lockStatusText } = formatMatchLockInfo(m);
    return {
      id: m.id,
      competition_id: m.competition_id,
      provider: m.provider,
      provider_match_id: m.provider_match_id,
      provider_match_url: m.provider_match_url,
      local_start_time: m.local_start_time,
      local_timezone: m.local_timezone,
      match_number: m.match_number,
      title: m.title,
      team_a: m.team_a,
      team_b: m.team_b,
      venue: m.venue,
      match_date: m.match_date,
      status: m.status,
      is_active: m.is_active,
      is_locked: deadline(m),
    selection_override: m.selection_override || null,
    stats_updated_at: m.stats_updated_at || null,
    score_revision: m.score_revision || 0,
      team_selection_disabled: Boolean(m.team_selection_disabled),
      qualification_pending: Boolean(m.qualification_pending),
      is_selectable: isSelectable,
      status_badge: statusBadge,
      lock_status_text: lockStatusText,
      winner_team: m.winner_team,
      scorecard_summary: m.scorecard_summary
    };
  });
  res.json(formatted);
});

apiRouter.get('/matches/active', (req, res) => {
  const active = db.getActiveMatch();
  if (!active) {
    return res.status(404).json({ detail: 'No active match found' });
  }

  const { isSelectable, statusBadge, lockStatusText } = formatMatchLockInfo(active);
  res.json({
    id: active.id,
    competition_id: active.competition_id,
    provider: active.provider,
    provider_match_id: active.provider_match_id,
    provider_match_url: active.provider_match_url,
    local_start_time: active.local_start_time,
    local_timezone: active.local_timezone,
    match_number: active.match_number,
    title: active.title,
    team_a: active.team_a,
    team_b: active.team_b,
    venue: active.venue,
    match_date: active.match_date,
    status: active.status,
    is_active: active.is_active,
    is_locked: deadline(active),
    selection_override: active.selection_override || null,
    stats_updated_at: active.stats_updated_at || null,
    score_revision: active.score_revision || 0,
    team_selection_disabled: Boolean(active.team_selection_disabled),
    qualification_pending: Boolean(active.qualification_pending),
    is_selectable: isSelectable,
    status_badge: statusBadge,
    lock_status_text: lockStatusText,
    winner_team: active.winner_team,
    scorecard_summary: active.scorecard_summary
  });
});

apiRouter.get('/matches/:match_id/players', (req, res) => {
  const matchId = parseInt(req.params.match_id, 10);
  const match = db.getMatchById(matchId);
  if (!match) {
    return res.status(404).json({ detail: 'Match not found' });
  }

  let teamA = match.team_a;
  let teamB = match.team_b;

  const players = db.getPlayersForMatch(matchId);

  const categorized = { WK: [], BAT: [], AR: [], BOWL: [] };
  const allPlayers = [];

  for (const p of players) {
    const pDict = {
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      is_captain: p.is_captain,
      wicketkeeper: p.wicketkeeper,
      availability_status: p.availability_status,
      active: p.active !== false,
      photo_url: p.photo_url || null,
      availability_note: p.availability_note || null,
      match_eligibility: p.match_eligibility,
      playing_xi_confirmed: p.playing_xi_confirmed === true,
      last_updated: p.last_updated,
      verified_source: p.verified_source
    };
    if (categorized[p.role]) {
      categorized[p.role].push(pDict);
    }
    allPlayers.push(pDict);
  }

  res.json({
    match: {
      id: match.id,
      match_number: match.match_number,
      title: match.title,
      team_a: teamA,
      team_b: teamB,
      venue: match.venue,
      status: match.status,
      is_active: match.is_active,
      provider: match.provider,
      provider_match_id: match.provider_match_id,
      match_date: match.match_date
    },
    total_players_available: players.length,
    categorized_players: categorized,
    all_players: allPlayers
  });
});

// ==========================================
// STRICT FANTASY TEAM SELECTION RULES
// ==========================================

apiRouter.post('/teams', authMiddleware, (req, res) => {
  const { match_id, player_ids, captain_id, vice_captain_id } = req.body || {};
  const matchId = parseInt(match_id, 10);
  const captainId = parseInt(captain_id, 10);
  const viceCaptainId = parseInt(vice_captain_id, 10);

  const match = db.getMatchById(matchId);
  if (!match) {
    return res.status(404).json({ detail: 'Match not found' });
  }

  if (match.team_selection_disabled) return res.status(400).json({ detail: 'Team selection is disabled for this fixture.' });

  if (!match.is_active) {
    const dateStr = new Date(match.match_date).toLocaleDateString();
    return res.status(400).json({
      detail: `This fixture is locked until its scheduled match day (${dateStr}). Player selection is strictly restricted to the currently active match fixture.`
    });
  }

  if (match.status === 'COMPLETED') {
    return res.status(400).json({ detail: 'This match has already ended. Team submissions are locked.' });
  }

  if (deadline(match)) {
    return res.status(400).json({
      detail: 'Lineup locked. The scheduled start, administrator lock or recorded match start has closed team and booster changes.'
    });
  }

  if (!Array.isArray(player_ids) || player_ids.length !== 11) {
    return res.status(400).json({
      detail: `You must select exactly 11 players (currently selected ${player_ids ? player_ids.length : 0}).`
    });
  }

  for (const id of player_ids) integer(id, 'Player ID', 1);
  integer(match_id, 'Match ID', 1);
  integer(captain_id, 'Captain ID', 1);
  integer(vice_captain_id, 'Vice captain ID', 1);
  const uniqueIds = new Set(player_ids);
  if (uniqueIds.size !== 11) {
    return res.status(400).json({ detail: 'Duplicate player selections detected.' });
  }

  if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
    return res.status(400).json({ detail: 'Choose two different players for Captain (2X) and Vice-Captain (1.5X).' });
  }
  if (![captainId, viceCaptainId].every(id => uniqueIds.has(id))) {
    return res.status(400).json({ detail: 'Captain and Vice-Captain must belong to your selected XI.' });
  }
  const savedPower = db.powerBoosterUses.find(x => x.user_id === req.user.id && x.match_id === matchId);
  if (savedPower?.role === '3X' && (!uniqueIds.has(savedPower.player_id) || [captainId, viceCaptainId].includes(savedPower.player_id))) {
    return res.status(409).json({ detail: 'Your active 3X target must remain in the XI and cannot be C or VC. Cancel the 3X booster before changing that player.' });
  }

  const compositionError = require('./teamComposition')(db, match, player_ids);
  if (compositionError) return res.status(400).json(compositionError);

  // Save or update fantasy team
  const user = req.user;
  const fName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Cricket Fan');
  const tName = user?.fantasy_team_name || `${fName} XI`;

  const team = db.saveFantasyTeam({
    userId: req.user.id,
    matchId,
    playerIds: player_ids,
    captainId,
    viceCaptainId,
    boosterId: null,
    fantasyTeamName: tName,
    fullName: fName,
    userEmail: user?.email || '',
    avatarUrl: user?.avatar_url || null
  });


  require('./recalculateTeams')(db, matchId);
  res.json({
    message: 'Fantasy team saved successfully!',
    team_id: team.id,
    power_booster_role: team.power_booster_role || null,
    lineup_revision: team.lineup_revision || 0,
    match_id: team.match_id,
    captain_id: team.captain_id,
    vice_captain_id: team.vice_captain_id,
    booster_id: team.booster_id,
    player_count: team.player_ids.length
  });
});

// Single 3X booster for ACC Men's Asia Cup Rising Stars 2026
const POWER_ROLES = ['3X'];
function powerStatus(userId, matchId) {
  const uses = db.powerBoosterUses.filter(x => x.user_id === userId).map(x => ({
    ...x, consumed: Boolean(x.consumed_at || x.state === 'CONSUMED' || deadline(db.getMatchById(x.match_id)))
  }));
  const active = uses.find(x => x.match_id === matchId);
  const team = db.getFantasyTeam(userId, matchId);
  const journey = db.matches.map(m => {
    const t = db.getFantasyTeam(userId, m.id);
    const use = uses.find(u => u.match_id === m.id);
    return {match_id:m.id, title:m.title, status:m.status, points:t?.total_points ?? null, rank:t?.rank ?? null, booster:use?.role || null, consumed:Boolean(use?.consumed)};
  });
  return { journey, uses, active_role: active?.role || null,
    active_player_id: active?.role === '3X' ? active.player_id : null,
    can_cancel: Boolean(active && !active.consumed && db.getMatchById(matchId)?.is_active && !db.getMatchById(matchId)?.team_selection_disabled && !deadline(db.getMatchById(matchId))),
    counts: {consumed:uses.filter(u=>u.consumed).length, reserved:uses.filter(u=>!u.consumed).length, available:POWER_ROLES.length-uses.length},
    team_id: team?.id || null, lineup_revision: team?.lineup_revision || 0 };
}
apiRouter.get('/power-boosters', authMiddleware, (req, res) => {
  const matchId = Number(req.query.match_id);
  if (!db.getMatchById(matchId)) return res.status(404).json({detail:'Match not found'});
  res.json(powerStatus(req.user.id, matchId));
});
apiRouter.post('/power-boosters/apply', authMiddleware, (req, res) => {
  const { match_id, role, team_id, lineup_revision, player_id } = req.body || {};
  if (!Number.isSafeInteger(match_id) || !Number.isSafeInteger(team_id) || !Number.isSafeInteger(lineup_revision)) return res.status(400).json({detail:'Invalid saved lineup reference.'});
  if (!POWER_ROLES.includes(role)) return res.status(400).json({detail:'Select a valid role booster.'});
  const match = db.getMatchById(match_id);
  const team = db.getFantasyTeam(req.user.id, match_id);
  if (!match || !team || team.player_ids.length !== 11) return res.status(400).json({detail:'Save your full lineup before applying a booster.'});
  const existing = db.powerBoosterUses.find(x => x.user_id === req.user.id && x.match_id === match.id);
  // Safe replay after a lost response: the same committed power is not spent twice.
  if (existing?.role === role && (role !== '3X' || existing.player_id === player_id)) return res.json(powerStatus(req.user.id, match.id));
  if (existing) return res.status(409).json({detail:'A power booster is already confirmed for this match.'});
  if (!match.is_active || match.team_selection_disabled || deadline(match) || match.status === 'COMPLETED') {
    return res.status(400).json({detail:'Booster deadline passed or this fixture is not open.'});
  }
  if (team.id !== team_id || (team.lineup_revision || 0) !== lineup_revision) return res.status(409).json({detail:'Your lineup changed. Save it again before confirming the booster.'});
  if (db.powerBoosterUses.some(x => x.user_id === req.user.id && x.role === role)) return res.status(409).json({detail:'This booster is already reserved for another match or consumed in this series. Cancel its reservation before that match locks.'});
  let target = null;
  if (role === '3X') {
    if (!Number.isSafeInteger(player_id) || !team.player_ids.includes(player_id) || [team.captain_id, team.vice_captain_id].includes(player_id)) {
      return res.status(400).json({detail:'Choose one saved XI player other than your Captain or Vice-Captain for 3X.'});
    }
    target = player_id;
  } else if (!team.player_ids.some(id => db.getPlayerForMatch(id, team.match_id)?.role === role)) {
    return res.status(400).json({detail:'Your saved lineup has no players in this role.'});
  }
  db.powerBoosterUses.push({user_id:req.user.id, match_id:match.id, role, reservation_id:require('crypto').randomUUID(), state:'RESERVED', ...(target ? {player_id:target}:{}), applied_at:new Date().toISOString()});
  team.power_booster_role = role;
  team.booster_id = target;
  require('./recalculateTeams')(db, match.id);
  res.json(powerStatus(req.user.id, match.id));
});

// A reservation can be released only while lineup editing remains open.
apiRouter.post('/power-boosters/cancel', authMiddleware, (req, res) => {
  const { match_id } = req.body || {};
  if (!Number.isSafeInteger(match_id)) return res.status(400).json({detail:'Invalid match ID.'});
  const match = db.getMatchById(match_id);
  if (!match) return res.status(404).json({detail:'Match not found.'});
  const index = db.powerBoosterUses.findIndex(x => x.user_id === req.user.id && x.match_id === match_id);
  if (index < 0) return res.json(powerStatus(req.user.id, match_id)); // idempotent cancel/retry
  if (db.powerBoosterUses[index].consumed_at || deadline(match) || !match.is_active || match.team_selection_disabled) return res.status(409).json({detail:'Match locked or not open. This booster cannot be canceled or refunded.'});
  if (req.body.reservation_id !== db.powerBoosterUses[index].reservation_id) return res.status(409).json({detail:'This reservation changed. Refresh your inventory before canceling.'});
  db.powerBoosterUses.splice(index, 1);
  const team = db.getFantasyTeam(req.user.id, match_id);
  if (team) {
    team.power_booster_role = null;
    team.booster_id = null;
    // LIVE scorecards may already exist: recalculate to avoid stale bonus points.
    const points = Object.fromEntries(db.getPlayerMatchStats(match_id).map(s => [s.player_id, s.fantasy_points || 0]));
    const selected = Object.fromEntries(team.player_ids.map(id => [id, points[id] || 0]));
    const roles = Object.fromEntries(team.player_ids.map(id => [id, db.getPlayerForMatch(id, team.match_id)?.role]));
    team.total_points = calculateTeamPoints(selected, team.captain_id, team.vice_captain_id, null, null, roles).totalPoints;
    const ordered = db.getFantasyTeamsByMatch(match_id).sort((a,b) => b.total_points-a.total_points || a.id-b.id);
    let lastPoints, lastRank;
    ordered.forEach((t,i) => { if (lastPoints !== t.total_points) lastRank = i+1; t.rank = lastRank; lastPoints = t.total_points; });
  }
  res.json(powerStatus(req.user.id, match_id));
});

apiRouter.get('/teams/my-team', optionalAuthMiddleware, (req, res) => {
  if (!req.user) {
    return res.json({ has_team: false, team: null });
  }

  const matchId = parseInt(req.query.match_id, 10);
  const team = db.getFantasyTeam(req.user.id, matchId);
  if (!team || team.player_ids?.length !== 11) {
    return res.json({ has_team: false, team: null });
  }

  const stats = db.getPlayerMatchStats(matchId);
  const statsMap = {};
  for (const s of stats) {
    statsMap[s.player_id] = s;
  }

  const playersData = team.player_ids.map(pId => {
    const p = db.getPlayerForMatch(pId, team.match_id);
    const isC = pId === team.captain_id;
    const isVc = pId === team.vice_captain_id;
    const isBooster = team.power_booster_role === '3X' && pId === team.booster_id;
    const mult = playerMultiplier(pId, p.role, team.captain_id, team.vice_captain_id, team.booster_id, team.power_booster_role);
    const stat = statsMap[pId] || { fantasy_points: 0.0, points_breakdown: {} };
    const eff = parseFloat((stat.fantasy_points * mult).toFixed(1));

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      is_captain: isC,
      is_vice_captain: isVc,
      is_booster: isBooster,
      multiplier: mult,
      base_points: stat.fantasy_points,
      effective_points: eff,
      breakdown: stat.points_breakdown || {}
    };
  });

  res.json({
    has_team: true,
    team: {
      id: team.id,
      match_id: team.match_id,
      captain_id: team.captain_id,
      vice_captain_id: team.vice_captain_id,
      booster_id: team.booster_id,
      power_booster_role: team.power_booster_role || null,
      lineup_revision: team.lineup_revision || 0,
      total_points: team.total_points,
      rank: team.rank,
      players: playersData
    }
  });
});

// ==========================================
// LEADERBOARDS & INTERACTIVE PITCH DETAILS
// ==========================================

apiRouter.get('/leaderboard', (req, res) => {
  const matchId = parseInt(req.query.match_id, 10);
  if (!matchId || isNaN(matchId)) {
    return res.status(400).json({ detail: 'Query parameter match_id is required' });
  }

  const match = db.getMatchById(matchId);
  if (!match) {
    return res.status(404).json({ detail: 'Match not found' });
  }

  const teams = db.getFantasyTeamsByMatch(matchId).filter(t => t.player_ids?.length === 11);
  teams.sort((a, b) => b.total_points - a.total_points || a.id - b.id);

  const usersById = new Map([...db.users].reverse().map(u => [u.id, u]));
  const leaderboard = [];
  const seenEmails = new Set();
  let rank = 1; let previousPoints; let position = 0;

  for (const t of teams) {
    const user = usersById.get(Number(t.user_id));
    const cleanEmail = (user?.email || t.user_email || `user_${t.user_id}@fantasy.pk`).toLowerCase().trim();

    if (!user || user.is_removed) continue;
    // Rule 2: Exclude test runner accounts
    if (cleanEmail.startsWith('test.manager.')) continue;

    // Rule 3: Strict 1 person per email
    if (seenEmails.has(cleanEmail)) continue;
    seenEmails.add(cleanEmail);

    const fName = user?.full_name || t.full_name || cleanEmail.split('@')[0] || 'Cricket Fan';
    const tName = user?.fantasy_team_name || t.fantasy_team_name || `${fName} XI`;

    position++; if(previousPoints !== t.total_points) rank=position; previousPoints=t.total_points;
    leaderboard.push({
      rank,
      team_id: t.id,
      user_id: t.user_id,
      is_verified: false,
      fantasy_team_name: tName,
      full_name: fName,
      avatar_url: user?.avatar_url || t.avatar_url || null,
      total_points: parseFloat(t.total_points.toFixed(1)),
      captain_id: deadline(match) ? t.captain_id : null,
      vice_captain_id: deadline(match) ? t.vice_captain_id : null,
      is_winner: (rank === 1 && match.status === 'COMPLETED' && t.total_points > 0)
    });
  }

  res.json({
    match: {
      id: match.id,
      title: match.title,
      status: match.status,
      winner_team: match.winner_team,
      venue: match.venue,
      date: match.match_date,
      stats_updated_at: match.stats_updated_at || null,
      score_revision: match.score_revision || 0
    },
    leaderboard: require('./engagement').withMovement(db, match, leaderboard)
  });
});

apiRouter.get('/leaderboard/team/:teamId', optionalAuthMiddleware, (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);
  let team = db.fantasyTeams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ detail: 'Fantasy team not found' });
  }

  const match = db.getMatchById(team.match_id);
  if (!deadline(match) && req.user?.id !== team.user_id && !req.user?.is_admin) {
    return res.status(403).json({ detail: 'Other managers’ lineups are private until the deadline.' });
  }
  const user = db.getUserById(team.user_id);

  const stats = db.getPlayerMatchStats(match.id);
  const statsMap = {};
  for (const s of stats) {
    statsMap[s.player_id] = s;
  }

  const categorized = { WK: [], BAT: [], AR: [], BOWL: [] };

  for (const pId of team.player_ids) {
    const p = db.getPlayerForMatch(pId, team.match_id);
    if (!p) continue;

    const isC = p.id === team.captain_id;
    const isVc = p.id === team.vice_captain_id;
    const isBooster = team.power_booster_role === '3X' && p.id === team.booster_id;
    const multiplier = playerMultiplier(p.id, p.role, team.captain_id, team.vice_captain_id, team.booster_id, team.power_booster_role);

    const stat = statsMap[p.id] || {
      fantasy_points: 0.0, runs: 0, balls: 0, fours: 0, sixes: 0,
      overs_bowled: 0.0, maidens: 0, runs_conceded: 0, wickets: 0,
      catches: 0, stumpings_direct_runouts: 0, points_breakdown: {}
    };

    const effPoints = parseFloat((stat.fantasy_points * multiplier).toFixed(1));

    const pInfo = {
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      is_captain: isC,
      is_vice_captain: isVc,
      is_booster: isBooster,
      multiplier,
      base_points: stat.fantasy_points,
      effective_points: effPoints,
      stat_summary: stat
    };

    if (categorized[p.role]) {
      categorized[p.role].push(pInfo);
    }
  }

  res.json({
    team_id: team.id,
    power_booster_role: team.power_booster_role || null,
    lineup_revision: team.lineup_revision || 0,
    fantasy_team_name: user?.fantasy_team_name || team.fantasy_team_name || 'Fantasy XI',
    full_name: user?.full_name || team.full_name || 'Cricket Fan',
    avatar_url: user?.avatar_url || team.avatar_url || null,
    total_points: parseFloat(team.total_points.toFixed(1)),
    rank: team.rank,
    match: {
      id: match.id,
      title: match.title,
      status: match.status,
      venue: match.venue
    },
    categorized_players: categorized
  });
});

apiRouter.delete('/leaderboard/team/:teamId', authMiddleware, adminMiddleware, (req, res) => {
  const teamId = parseInt(req.params.teamId, 10);
  if (isNaN(teamId)) {
    return res.status(400).json({ detail: 'Invalid team ID' });
  }

  const removed = db.deleteFantasyTeam(teamId);
  if (!removed) {
    return res.status(404).json({ detail: 'Team not found or already deleted' });
  }

  res.json({
    success: true,
    message: `Team "${removed.fantasy_team_name || removed.id}" permanently removed by administrator.`,
    removed_team: {
      id: removed.id,
      user_id: removed.user_id,
      match_id: removed.match_id,
      fantasy_team_name: removed.fantasy_team_name,
      full_name: removed.full_name
    }
  });
});

apiRouter.get('/leaderboard/overall', (req, res) => {
  const overallList = [];
  const seenEmails = new Set();
  const seenUserIds = new Set();

  const completedMatchesCount = db.matches.filter(m => m.status === 'COMPLETED').length;
  const isSeriesConcluded = (completedMatchesCount >= db.matches.length);

  // Collate all registered and active users
  // Request-local indexes: tied to the current serialized transaction, never stale.
  const usersById = new Map([...db.users].reverse().map(u => [u.id, u]));
  const teamsByUser = new Map();
  for (const team of db.fantasyTeams) {
    if (!teamsByUser.has(team.user_id)) teamsByUser.set(team.user_id, []);
    teamsByUser.get(team.user_id).push(team);
  }
  const candidateIds = new Set();
  const candidateUsers = [];
  for (const u of db.users) {
    if (u.is_removed) continue;
    candidateIds.add(u.id);
    candidateUsers.push({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      fantasy_team_name: u.fantasy_team_name,
      avatar_url: u.avatar_url
    });
  }
  for (const t of db.fantasyTeams) {
    const owner = usersById.get(Number(t.user_id));
    if (owner?.is_removed) continue;
    if (!candidateIds.has(t.user_id)) {
      candidateIds.add(t.user_id);
      candidateUsers.push({
        id: t.user_id,
        email: t.user_email || `user_${t.user_id}@fantasy.pk`,
        full_name: t.full_name || 'Cricket Fan',
        fantasy_team_name: t.fantasy_team_name || `Team #${t.user_id}`,
        avatar_url: t.avatar_url || null
      });
    }
  }

  for (const u of candidateUsers) {
    if (u.email && u.email.toLowerCase().startsWith('test.manager.')) continue;
    const userObj = usersById.get(Number(u.id));
    if (userObj?.is_removed) continue;

    const cleanEmail = u.email ? u.email.toLowerCase().trim() : `user_${u.id}@fantasy.pk`;
    if (seenEmails.has(cleanEmail) || seenUserIds.has(u.id)) continue;
    seenEmails.add(cleanEmail);
    seenUserIds.add(u.id);

    const userTeams = (teamsByUser.get(parseInt(u.id, 10)) || []).filter(t => t.player_ids?.length === 11);
    if (userTeams.length === 0) continue;

    const totalPts = userTeams.reduce((sum, t) => sum + (t.total_points || 0), 0);
    const matchScores = {};
    for (const t of userTeams) {
      matchScores[t.match_id] = parseFloat((t.total_points || 0).toFixed(1));
    }

    const representativeTeam = userTeams.find(t => t.match_id === 1) || userTeams[0];

    overallList.push({
      user_id: u.id,
      team_id: representativeTeam ? representativeTeam.id : u.id,
      is_verified: false,
      full_name: u.full_name || 'Cricket Fan',
      fantasy_team_name: u.fantasy_team_name || `${u.full_name || 'Cricket'} XI`,
      avatar_url: u.avatar_url,
      matches_played: userTeams.length || 1,
      total_points: parseFloat(totalPts.toFixed(1)),
      match_scores: matchScores
    });
  }

  overallList.sort((a, b) => b.total_points - a.total_points);

  overallList.forEach((item, idx) => {
    item.rank = idx > 0 && overallList[idx-1].total_points === item.total_points ? overallList[idx-1].rank : idx + 1;
    item.is_champion = (item.rank === 1 && isSeriesConcluded && item.total_points > 0);
  });

  res.json({
    tournament_title: 'Pakistan A vs Sri Lanka A Fantasy 2026',
    completed_matches: completedMatchesCount,
    is_series_concluded: isSeriesConcluded,
    leaderboard: overallList
  });
});

// ==========================================
// TOURNAMENT STANDINGS
// ==========================================

apiRouter.get('/standings', (req, res) => {
  const standings = db.getStandings();
  res.json(standings.map(s => ({
    team: s.team,
    played: s.played,
    won: s.won,
    lost: s.lost,
    tied: s.tied || 0,
    no_result: s.no_result || 0,
    points: s.points,
    nrr: s.nrr
  })));
});

// ==========================================
// ADMIN MATCH SIMULATION & LIFECYCLE
// ==========================================

apiRouter.get('/health', (req, res) => {
  const hosted = Boolean(process.env.VERCEL);
  res.json({
    status: 'healthy',
    version: '3.1.0',
    commit: 'verified-server-saves',
    node_env: process.env.NODE_ENV || 'production',
    runtime: 'Node.js (Express)',
    competition_id: 'ACC_RISING_STARS_FINAL_2026',
    series: 'Pakistan A vs Sri Lanka A Fantasy 2026',
    teams: ['Pakistan A (PAK)', 'Sri Lanka A (SL)'],
    live_cricket_api_connected: false, // Configuration alone does not prove upstream connectivity.
    live_cricket_api_configured: Boolean(process.env.CRICKET_API_KEY),
    live_cricket_status_endpoint: '/api/live-scores',
    live_cricket_data_note: process.env.CRICKET_API_KEY ? 'Optional cached match scores enabled. See /api/live-scores for availability. Fantasy points remain admin-managed.' : 'No live cricket API key configured. Admin-entered scorecards are required for fantasy points.',
    database: {
      storage_engine: hasRedis ? 'Upstash Cloud Redis (Permanent Central Database)' : (hosted ? 'Not configured (Redis required on Vercel)' : 'Local Disk JSON'),
      is_cloud_persisted: hasRedis,
      users_enrolled: db.users.length,
      teams_enrolled: db.fantasyTeams.length
    },
    timestamp: new Date().toISOString()
  });
});

// Mount the API Router on both '/' and '/api'
apiRouter.use('/engagement', require('./engagementRoutes'));
app.use('/api', rateLimit, persistence, apiRouter);
app.use('/', rateLimit, persistence, apiRouter);


// ==========================================
// PRODUCTION STATIC FRONTEND SERVING
// ==========================================
// If the React frontend has been built (dist/ folder exists),
// serve it directly for 100% unified deployment!
const FRONTEND_DIST_DIRS = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, './frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), 'dist')
];

let staticDistDir = null;
for (const dir of FRONTEND_DIST_DIRS) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    staticDistDir = dir;
    break;
  }
}

if (staticDistDir) {
  const assetsDir = path.join(staticDistDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir));
  }

  // Catch-all route to serve index.html for client-side React Router
  app.get('*', (req, res) => {
    // Exclude API requests
    if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/matches')) {
      return res.status(404).json({ detail: 'Not Found' });
    }

    res.sendFile(path.join(staticDistDir, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ detail: `API route '${req.method} ${req.url}' not found.` });
});

app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  res.status(err.status||500).json({detail:err.status===413?'Image is too large. Choose a smaller image.':err.status&&err.status<500?err.message:'Unexpected server error. Please try again.'});
});
module.exports = app;
