// Exercises production persistence branch with a deterministic Redis test double.
// This does not claim connectivity to a real Upstash account.
process.env.NODE_ENV='test';
process.env.JWT_SECRET='synthetic-transaction-secret-for-tests-only';
process.env.UPSTASH_REDIS_REST_URL='https://synthetic.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN='synthetic-token';
const assert=require('node:assert/strict');
const values=new Map();let rejectCommit=false,loseLease=false,failAcquire=false,contention=0;
class FakeRedis {
 async get(k){return values.get(k)??null;}
 async set(k,v,opts={}){if(opts.nx&&values.has(k))return null;values.set(k,v);return 'OK';}
 async eval(script,keys,args){
  if(script.includes("'NX','PX'")){if(failAcquire){failAcquire=false;throw Error('Storage unavailable');}if(contention-->0)return [0,''];if(values.has(keys[1]))return [0,''];values.set(keys[1],args[0]);return [1,values.get(keys[0])||''];}
  if(keys.length===1){if(values.get(keys[0])===args[0]){values.delete(keys[0]);return 1;}return 0;}
  if(rejectCommit){rejectCommit=false;throw Error('Synthetic storage outage');}
  if(loseLease){loseLease=false;values.delete(keys[1]);return 0;}
  if(values.get(keys[1])!==args[2]||(values.get(keys[0])||'')!==args[0])return 0;
  values.set(keys[0],args[1]);return 1;
 }
}
require.cache[require.resolve('@upstash/redis')]={exports:{Redis:FakeRedis}};
const db=require('../api/_lib/database');for(const m of db.matches){m.match_date='2099-01-01T00:00:00Z';m.team_selection_disabled=false;m.qualification_pending=false;}
const app=require('../api/_lib/app');
const {STATE_KEY}=require('../api/_lib/persistence');
const server=app.listen(0,'127.0.0.1',async()=>{
 let token;const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(url,body){if(url==='/power-boosters/cancel')body={...body,reservation_id:db.powerBoosterUses.find(u=>u.match_id===body.match_id)?.reservation_id};let r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 try{
 token=(await call('/auth/signup',{email:'transaction@example.test',password:'Synthetic-password',full_name:'Transaction',fantasy_team_name:'Transaction XI'})).data.access_token;
 const ids=[501, 502, 503, 603, 604, 508, 607, 512, 513, 611, 612];
 const t=(await call('/teams',{match_id:1,player_ids:ids,captain_id:502,vice_captain_id:603})).data;
 const ownerToken=token;token=null;
 assert.equal((await call(`/leaderboard/team/${t.team_id}`)).status,403,'private before lock');
 token=ownerToken;assert.equal((await call(`/leaderboard/team/${t.team_id}`)).status,200);
 failAcquire=true;assert.equal((await call('/leaderboard/overall')).status,503);
 contention=2;const waited=Date.now();assert.equal((await call('/leaderboard/overall')).status,200);assert.ok(Date.now()-waited>=90,'lease contention is retried');
 const power={match_id:1,team_id:t.team_id,lineup_revision:t.lineup_revision,role:'3X',player_id:501};
 rejectCommit=true;assert.equal((await call('/power-boosters/apply',power)).status,503);
 assert.equal((await call('/power-boosters?match_id=1')).data.active_role,null);
 loseLease=true;assert.equal((await call('/power-boosters/apply',power)).status,503);
 assert.equal((await call('/power-boosters?match_id=1')).data.active_role,null);
 assert.equal((await call('/power-boosters/apply',power)).status,200);
 rejectCommit=true;assert.equal((await call('/power-boosters/cancel',{match_id:1})).status,503);
 assert.equal((await call('/power-boosters?match_id=1')).data.active_role,'3X');
 let state=JSON.parse(values.get(STATE_KEY));state.matches[0].match_date=new Date(Date.now()-1000).toISOString();values.set(STATE_KEY,JSON.stringify(state));
 rejectCommit=true;assert.equal((await call('/power-boosters?match_id=1')).status,503,'never confirm an uncommitted read-triggered lock');
 assert.equal((await call('/power-boosters?match_id=1')).data.can_cancel,false);
 assert.ok(JSON.parse(values.get(STATE_KEY)).powerBoosterUses[0].consumed_at);
 assert.equal((await call('/power-boosters/cancel',{match_id:1})).status,409);
 // Concurrent writes and reads still share the same serialized transaction boundary.
 state=JSON.parse(values.get(STATE_KEY));
 state.matches[0].match_date='2099-01-01T00:00:00Z';
 delete state.matches[0].booster_locked_at;
 delete state.matches[0].booster_lock_reason;
 state.powerBoosterUses=[];
 state.users.find(u=>u.email==='transaction@example.test').is_admin=true;
 values.set(STATE_KEY,JSON.stringify(state));
 const user2Token=(await call('/auth/signup',{email:'user2@example.test',password:'Synthetic-password2',full_name:'User Two',fantasy_team_name:'User Two XI'})).data.access_token;
 token=user2Token;
 const concurrent=await Promise.all([
   call('/teams',{match_id:1,player_ids:ids,captain_id:503,vice_captain_id:604}),
   ...Array.from({length:6},()=>call('/leaderboard/overall'))
 ]);
 for(const result of concurrent)assert.equal(result.status,200,JSON.stringify(result));
 assert.equal((await call('/teams/my-team?match_id=1')).data.has_team,true);
 token=ownerToken;
 assert.equal((await call('/admin/toggle-lock/1',{})).status,200);
 assert.equal((await call('/admin/matches/1/stats',{stats:[{player_id:502,played_xi:true,dismissed:false,runs:30,balls_faced:20,fours:3,sixes:1}],revision:0})).status,200);
 const oldPoints=(await call(`/leaderboard/team/${t.team_id}`)).data.total_points;
 assert.equal((await call('/admin/matches/1/stats',{stats:[{player_id:502,played_xi:true,dismissed:false,runs:60,balls_faced:35,fours:6,sixes:2}],revision:1})).status,200);
 const corrected=(await call(`/leaderboard/team/${t.team_id}`)).data;
 assert.ok(corrected.total_points>oldPoints);
 assert.equal((await call('/leaderboard?match_id=1')).data.leaderboard[0].total_points,corrected.total_points);
 state=JSON.parse(values.get(STATE_KEY));assert.equal(state.fantasyTeams.length,2);assert.ok(state.matches[0].booster_locked_at);
 console.log('PASS: concurrent scoring + saves + reads, corrections, privacy, unavailable storage and lock contention.');
 console.log('PASS: Redis-branch fault injection, failed apply/cancel rollback, lost write lease, retry, read-triggered lock commit and non-refund. Real Redis service not used.');
 }catch(e){console.error(e);process.exitCode=1;}finally{server.close();}
});
