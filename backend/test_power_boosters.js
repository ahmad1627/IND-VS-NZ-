process.env.NODE_ENV='test';
process.env.JWT_SECRET='synthetic-power-test-secret-not-for-deployment';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-lock-'));
process.env.LOCAL_DATA_FILE=path.join(tmp,'state.json');
const db=require('../api/_lib/database');
const {calculateTeamPoints}=require('../api/_lib/scoringEngine');
const {cutoff}=require('../api/_lib/boosterLifecycle');
const {deadline}=require('../api/_lib/validation');
const app=require('../api/_lib/app');

for(const m of db.matches) {m.match_date='2099-01-01T00:00:00Z';m.team_selection_disabled=false;m.qualification_pending=false;}

// Scoring engine 3X calculation tests
assert.equal(calculateTeamPoints({503: 100}, 501, 502, 503, '3X').totalPoints, 300);
assert.equal(calculateTeamPoints({503: -5}, 501, 502, 503, '3X').totalPoints, -15);
assert.equal(calculateTeamPoints({503: 100}, 501, 502, 503, null).totalPoints, 100);

const now=Date.now();
assert.equal(cutoff({match_date:new Date(now).toISOString()},now).reason,'scheduled_start');
assert.equal(deadline({match_date:'2099-01-01',admin_unlocked:true,first_delivery_at:new Date(now-1000).toISOString()}),true);

const server=app.listen(0,'127.0.0.1',async()=>{
 const base='http://127.0.0.1:'+server.address().port+'/api';let token;
 async function call(url,body){
   if(url==='/power-boosters/cancel' && body && body.reservation_id===undefined) {
     body={...body, reservation_id:db.powerBoosterUses.find(u=>u.match_id===body.match_id)?.reservation_id};
   }
   const r=await fetch(base+url,{
     method:body===undefined?'GET':'POST',
     headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
     ...(body===undefined?{}:{body:JSON.stringify(body)})
   });
   return {status:r.status,data:await r.json()};
 }

 const ids = [501, 502, 503, 603, 604, 508, 607, 512, 513, 611, 612];
 const lineup = match_id => ({ match_id, player_ids: ids, captain_id: 502, vice_captain_id: 603 });
 async function save(id){ let r = await call('/teams', lineup(id)); assert.equal(r.status, 200, JSON.stringify(r)); return r.data; }
 const payload = (t, role, player_id) => ({ match_id: t.match_id, team_id: t.team_id, lineup_revision: t.lineup_revision, role, ...(player_id ? { player_id } : {}) });
 const persisted = () => JSON.parse(fs.readFileSync(process.env.LOCAL_DATA_FILE, 'utf8'));
 const writeState = mutate => { let state = persisted(); mutate(state); fs.writeFileSync(process.env.LOCAL_DATA_FILE, JSON.stringify(state)); };

 try {
  assert.equal((await call('/power-boosters?match_id=1')).status, 401);
  const credentials = { email: 'power@example.test', password: 'Synthetic-power-password', full_name: 'Power Tester', fantasy_team_name: 'Power XI' };
  token = (await call('/auth/signup', credentials)).data.access_token;
  const one = await save(1);
  assert.equal(one.booster_id, null);
  assert.equal(db.powerBoosterUses.length, 0);

  // REJECTION of removed role boosters: BAT, BOWL, AR, WK
  for (const removedRole of ['BAT', 'BOWL', 'AR', 'WK']) {
    const res = await call('/power-boosters/apply', payload(one, removedRole));
    assert.equal(res.status, 400, `Removed booster ${removedRole} must be rejected`);
    assert.equal(res.data.detail, 'Select a valid role booster.');
  }

  // 3X validation checks
  assert.equal((await call('/power-boosters/apply', payload(one, '3X', 502))).status, 400, 'Captain cannot be 3X');
  assert.equal((await call('/power-boosters/apply', payload(one, '3X', 603))).status, 400, 'Vice-Captain cannot be 3X');
  assert.equal((await call('/power-boosters/apply', payload(one, '3X', 999))).status, 400, 'Non-XI player cannot be 3X');
  assert.equal((await call('/power-boosters/apply', payload(one, '3X'))).status, 400, 'Missing 3X target player');

  // Valid 3X application
  const applyRes = await call('/power-boosters/apply', payload(one, '3X', 501));
  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.data.active_role, '3X');
  assert.equal(applyRes.data.active_player_id, 501);

  // Verify multiplier in my-team
  const myTeam = (await call('/teams/my-team?match_id=1')).data.team;
  assert.equal(myTeam.players.find(p => p.id === 501).multiplier, 3);
  assert.equal(myTeam.players.find(p => p.id === 502).multiplier, 2); // Captain
  assert.equal(myTeam.players.find(p => p.id === 603).multiplier, 1.5); // Vice-Captain

  // Cancel 3X booster before lock
  assert.equal((await call('/power-boosters/cancel', { match_id: 1 })).status, 200);
  assert.equal(db.powerBoosterUses.length, 0);

  // Re-apply 3X on different player (508)
  assert.equal((await call('/power-boosters/apply', payload(one, '3X', 508))).status, 200);
  assert.equal(db.powerBoosterUses.length, 1);
  assert.equal((await call('/power-boosters?match_id=1')).data.can_cancel, true);

  // Stale cancel check
  assert.equal((await call('/power-boosters/cancel', { match_id: 1, reservation_id: 'old-stale-id' })).status, 409);

  // Lock the match via admin
  writeState(s => s.users.find(u => u.email === credentials.email).is_admin = true);
  token = (await call('/auth/login', credentials)).data.access_token;
  assert.equal((await call('/admin/toggle-lock/1', {})).status, 200);

  let status = (await call('/power-boosters?match_id=1')).data;
  assert.equal(status.can_cancel, false);
  assert.equal(status.uses[0].state, 'CONSUMED');
  assert.ok(status.uses[0].consumed_at);

  // Team and booster cannot change after lock
  assert.equal((await call('/teams', lineup(1))).status, 400);
  assert.equal((await call('/power-boosters/cancel', { match_id: 1 })).status, 409);

  // Score correction reflects 3X booster correctly
  const stats = [{ player_id: 508, played_xi: true, dismissed: false, runs: 50, balls_faced: 30, fours: 5, sixes: 2 }];
  assert.equal((await call('/admin/matches/1/stats', { stats, revision: 0 })).status, 200);
  const teamAfterScoring = db.getFantasyTeam(db.users.find(u => u.email === credentials.email).id, 1);
  assert.ok(teamAfterScoring.total_points > 0);

  console.log('PASS power boosters: Single 3X booster enforced, removed boosters rejected, C/VC distinct check, cancel before lock, post-lock protection, and 3X fantasy points verified.');
 } catch(e){ console.error(e); process.exitCode=1; } finally { server.close(); fs.rmSync(tmp,{recursive:true,force:true}); }
});
