process.env.NODE_ENV='test';
process.env.JWT_SECRET='synthetic-test-secret-not-for-deployment-123';
const assert=require('node:assert/strict');
const db=require('../api/_lib/database');
const app=require('../api/_lib/app');
// Synthetic fixture date keeps regression tests repeatable after the real final.
db.matches[0].match_date='2099-01-01T00:00:00Z';
const server=app.listen(0,'127.0.0.1',async()=>{
const base='http://127.0.0.1:'+server.address().port+'/api';let token;
async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
try{
const user={email:'qa@example.test',password:'Synthetic-test-password',full_name:'QA Tester',fantasy_team_name:'QA Test XI'};
let a=await call('/auth/signup',user);assert.equal(a.status,200);token=a.data.access_token;assert.equal((await call('/auth/login',user)).status,200);
const matches=(await call('/matches')).data;assert.equal(matches.length,1);
assert.equal(matches[0].qualification_pending,true);
assert.equal((await call('/teams',{match_id:1,player_ids:[],captain_id:501,vice_captain_id:502})).status,400);
db.users.find(u=>u.email===user.email).is_admin=true;token=(await call('/auth/login',user)).data.access_token;
assert.equal((await call('/admin/matches/1/activate',{})).status,200);
assert.equal((await call('/matches')).data[0].qualification_pending,false);
for(const m of matches){
  const pool=(await call('/matches/'+m.id+'/players')).data.all_players;assert.equal(pool.length,30);
  const ids=[501, 502, 503, 603, 604, 508, 607, 512, 513, 611, 612];
  let r=await call('/teams',{match_id:m.id,player_ids:ids,captain_id:502,vice_captain_id:603});assert.equal(r.status,200,JSON.stringify(r));
  r=await call('/teams/my-team?match_id='+m.id);assert.equal(r.data.has_team,true);assert.equal(r.data.team.players.length,11);
}
assert.equal(db.fantasyTeams.length,1);assert.equal(new Set(db.fantasyTeams.map(t=>t.id)).size,1);
assert.equal((await call('/teams',{match_id:1,player_ids:Array(11).fill(501),captain_id:501,vice_captain_id:603})).status,400);
assert.equal((await call('/health')).data.live_cricket_api_connected,false);
// Real authenticated admin scoring path, with synthetic data only.
db.users[0].is_admin=true;token=(await call('/auth/login',user)).data.access_token;
assert.equal((await call('/admin/toggle-lock/1',{})).status,200);
const stats={stats:[{player_id:502,played_xi:true,dismissed:false,runs:30,balls_faced:20,fours:3,sixes:1}],revision:0};
a=await call('/admin/matches/1/stats',stats);assert.equal(a.status,200,JSON.stringify(a));
const points=db.fantasyTeams[0].total_points;assert.ok(points>0);
assert.equal((await call('/admin/matches/1/stats',stats)).status,409);assert.equal(db.fantasyTeams[0].total_points,points);
const roster=db.getPlayersForMatch(1);
const xi=['PAK','SL'].flatMap(team=>roster.filter(p=>p.team===team).slice(0,11)).map(p=>({player_id:p.id,played_xi:true,dismissed:false}));
assert.equal((await call('/admin/matches/1/stats',{stats:xi,revision:1,finalize:true,result:'WIN',winner_team:'SL',innings:{a:{runs:100,wickets:10,overs:10},b:{runs:101,wickets:0,overs:10}}})).status,200);
assert.equal(db.standings.find(s=>s.team==='PAK').nrr,-8.1,'all-out 50-over innings uses 300 balls for NRR');
console.log('PASS HTTP: signup/login; complete squad pools; team saves/readbacks; duplicate rejection; truthful live status; admin lock/scoring; stale revision rejected.');
}catch(e){console.error(e);process.exitCode=1}finally{server.close();}
});
