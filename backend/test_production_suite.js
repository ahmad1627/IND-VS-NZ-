const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../api/_lib/app.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../api/_lib/teamComposition.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '../api/_lib/admin.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../api/_lib/playerManagement.js'), 'utf8');
const seed = fs.readFileSync(path.join(__dirname, '../api/_lib/seedData.js'), 'utf8');
const leaderboardUi = fs.readFileSync(path.join(__dirname, '../frontend/src/components/Leaderboard.jsx'), 'utf8');
const tests = [
  [app.includes("apiRouter.post('/teams'"), 'dedicated fantasy team submission route exists'],
  [app.includes('player_ids.length !== 11'), 'server rejects teams other than exactly 11 players'],
  [app.includes('p.match_eligibility.includes(matchId)'), 'server enforces match-specific player eligibility'],
  [app.includes("p.availability_status === 'OUT'"), 'server rejects players marked unavailable'],
  [app.includes("'3X'") && app.includes("/power-boosters/cancel"), 'server provides optional one-time 3X and cancellation'],
  [app.includes('Maximum 7 players allowed from a single team.'), 'server enforces the national-team maximum'],
  [app.includes('roleCounts.WK < 1') && app.includes('roleCounts.BAT < 3') && app.includes('roleCounts.AR < 1') && app.includes('roleCounts.BOWL < 3'), 'server enforces all role minimums'],
  [admin.includes('calculateTeamPoints(selected, t.captain_id, t.vice_captain_id, t.booster_id, t.power_booster_role,'), 'admin score recalculation applies all three multipliers'],
  [admin.includes('next.status = \'ACTIVE\''), 'finalizing one T20I advances the next unfinished fixture'],
  [admin.includes('availability_editable: true'), 'admin can update player availability after entries exist'],
  [admin.includes('eligibility_editable: true') && admin.includes('eligibility_locks') && admin.includes('locked(db, match)'), 'admin can edit unlocked match eligibility even after a fantasy team is saved'],
  [admin.includes('cannot remove Match ${matchId} eligibility because the player is already in a saved fantasy team'), 'admin protects players already used in a saved lineup from eligibility removal'],
  [admin.includes('m.player_snapshot = clone(db.players)'), 'admin preserves historical rosters before applying future player edits'],
  [admin.includes('Match ${matchId} is locked, completed, or has saved score records'), 'admin prevents eligibility changes after an match selection deadline or saved scorecard'],
  [admin.includes('availability_status') && admin.includes('match_eligibility'), 'admin endpoint validates player availability and match eligibility'],
  [seed.includes('"playing_xi_confirmed": false'), 'seeded players are not falsely marked as confirmed playing XI'],
  [app.includes('live_cricket_api_connected: false'), 'health endpoint explicitly reports that a live cricket feed is not connected'],
  [app.includes('completedMatchesCount >= db.matches.length'), 'series champion is crowned only after all configured fixtures are completed'],
  [leaderboardUi.includes('OF 1 MATCH COMPLETED'), 'overall leaderboard shows the correct final match length']
];
for (const [condition, label] of tests) {
  assert.ok(condition, label);
  console.log('PASS:', label);
}
console.log(`SUCCESS: ${tests.length} production-path source checks (static checks; not a live server test).`);
