process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-player-management-test-secret';
const assert = require('node:assert/strict');
const db = require('../api/_lib/database');
const app = require('../api/_lib/app');
const {calculateTeamPoints} = require('../api/_lib/scoringEngine');
const clone = x => JSON.parse(JSON.stringify(x));
const server = app.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token;
  async function call(path, body) {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
    return {status:r.status, data:await r.json()};
  }
  async function read() { const r = await call('/admin/players'); assert.equal(r.status,200); return r.data; }
  async function save(data) { return call('/admin/players',{players:data.players,revision:data.revision}); }
  try {
    assert.equal((await call('/admin/players')).status,401);
    const credentials = {email:'player-admin@example.test',password:'synthetic-password-123',full_name:'Test Admin',fantasy_team_name:'Test XI'};
    token = (await call('/auth/signup',credentials)).data.access_token;
    assert.equal((await call('/admin/players')).status,403);
    assert.equal((await call('/admin/players',{players:[]})).status,403);
    db.users[0].is_admin = true;
    token = (await call('/auth/login',credentials)).data.access_token;
    for (const m of db.matches) {m.match_date = '2099-01-01T00:00:00Z';m.team_selection_disabled=false;m.qualification_pending=false;}
    const ids = [501, 502, 503, 603, 604, 508, 607, 512, 513, 611, 612];
    assert.equal((await call('/teams',{match_id:1,player_ids:ids,captain_id:502,vice_captain_id:603})).status,200);
    assert.equal((await call('/admin/toggle-lock/1',{})).status,200);
    const preserved = clone({teams:db.fantasyTeams, boosts:db.powerBoosterUses, stats:db.playerMatchStats, users:db.users});
    const original = clone(db.getPlayerById(502));
    let data = await read();
    const p = data.players.find(p => p.id === 502);
    p.role = original.role === 'BAT' ? 'BOWL' : 'BAT'; p.team = 'SL'; p.name = 'Edited Player'; p.active = false;
    data.players.push({name:'Manual Player',team:'PAK',role:'BOWL',match_eligibility:[],active:true});
    assert.equal((await save(data)).status,200);
    assert.deepEqual(db.getPlayerForMatch(502,1),original);
    assert.equal(db.getPlayerById(502).name,'Edited Player');
    assert.deepEqual({teams:db.fantasyTeams, boosts:db.powerBoosterUses, stats:db.playerMatchStats, users:db.users},preserved);
    const added = db.players.find(p => p.name === 'Manual Player'); assert.ok(added.id); assert.equal(added.external_player_id,null);
    for (const id of [1]) {
      const pool = (await call(`/matches/${id}/players`)).data.all_players;
      assert.equal(pool.some(p => p.id === added.id),false);
      assert.equal(pool.some(p => p.id === 502),true);
    }
    const saved = clone(db.snapshot()); db.restore(saved);
    assert.deepEqual(db.getPlayerForMatch(502,1),original);
    assert.ok(db.players.find(p => p.id === added.id));
    assert.equal((await save(data)).status,409,'stale editor rejected');
    data = await read(); data.players.find(p => p.id === added.id).match_eligibility.push(1);
    assert.equal((await save(data)).status,400,'locked eligibility rejected');
    data = await read(); data.players[0].match_eligibility.push(999);
    assert.equal((await save(data)).status,400,'unknown match rejected');
    data = await read(); data.players[0].role='INVALID'; assert.equal((await save(data)).status,400);
    data = await read(); data.players.pop(); assert.equal((await save(data)).status,400,'deletion rejected');
    const beforeUndo = (await call('/teams/my-team?match_id=1')).data.team.players.find(p => p.id === 502);
    assert.equal(beforeUndo.role,original.role); assert.equal(beforeUndo.team,original.team);
    assert.equal((await call('/admin/players/undo',{revision:(await read()).revision})).status,200);
    assert.equal(db.getPlayerById(502).role,original.role);
    assert.equal(db.getPlayerById(added.id).active,false);
    assert.equal(db.getPlayerForMatch(502,1).role,original.role);
    // All role transitions, including an empty eligibility set, remain possible.
    for (const role of ['WK','BAT','BOWL','AR','WK']) {
      data = await read(); const p = data.players.find(p => p.id === added.id); p.role=role; p.match_eligibility=[];
      assert.equal((await save(data)).status,200); assert.equal(db.getPlayerById(added.id).role,role);
    }
    // Scoring and booster reads resolve the historical role, even after later edits.
    const roles = Object.fromEntries(ids.map(id => [id,db.getPlayerForMatch(id,1).role]));
    const expectedRoles = Object.fromEntries(saved.matches[0].player_snapshot.filter(p => ids.includes(p.id)).map(p => [p.id,p.role]));
    assert.deepEqual(roles,expectedRoles);
    const pts = Object.fromEntries(ids.map(id => [id,10]));
    for(const booster of ['3X']) assert.deepEqual(calculateTeamPoints(pts,502,603,501,booster,roles),calculateTeamPoints(pts,502,603,501,booster,expectedRoles));
    console.log('PASS player management: authorization, server IDs, edits after saved teams, eligibility, active filtering, locked history, persistence round-trip, validation, conflicts, undo and 3X booster role.');
  } catch(e) { console.error(e); process.exitCode=1; } finally { server.close(); }
});
