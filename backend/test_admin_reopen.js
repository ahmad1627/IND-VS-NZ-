process.env.NODE_ENV='test';
process.env.JWT_SECRET='synthetic-admin-reopen-test-not-production';
const assert=require('node:assert/strict');
const db=require('../api/_lib/database');
const app=require('../api/_lib/app');
const m=db.matches[0];m.match_date='2099-01-01T00:00:00Z';
const server=app.listen(0,'127.0.0.1',async()=>{
 const base=`http://127.0.0.1:${server.address().port}/api`;let token;
 async function call(path,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
 async function ok(path,body){const r=await call(path,body);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
 try{
 const user={email:'user@reopen.test',password:'Synthetic-user-password',full_name:'Test User',fantasy_team_name:'Test XI'};
 const manager={email:'admin@reopen.test',password:'Synthetic-admin-password',full_name:'Test Admin',fantasy_team_name:'Admin XI'};
 const userToken=(await ok('/auth/signup',user)).access_token;
 token=userToken;assert.equal((await call('/admin/toggle-lock/1',{locked:false})).status,403);
 await ok('/auth/signup',manager);db.users.find(u=>u.email===manager.email).is_admin=true;
 const adminToken=(await ok('/auth/login',manager)).access_token;token=adminToken;
 assert.equal((await call('/admin/toggle-lock/1',{locked:false})).status,400,'qualification gate');
 await ok('/admin/matches/1/activate',{});
 const ids=[501,502,503,603,604,508,607,512,513,611,612];
 const draft={match_id:1,player_ids:ids,captain_id:502,vice_captain_id:603};
 token=userToken;let t=await ok('/teams',draft);
 await ok('/power-boosters/apply',{match_id:1,team_id:t.team_id,lineup_revision:t.lineup_revision,role:'3X',player_id:508});
 token=adminToken;await ok('/admin/toggle-lock/1',{locked:true});await ok('/admin/toggle-lock/1',{locked:true});
 assert.equal((await ok('/matches'))[0].is_locked,true);
 token=userToken;assert.equal((await call('/teams',draft)).status,400);assert.equal((await ok('/power-boosters?match_id=1')).uses[0].state,'CONSUMED');
 token=adminToken;await ok('/admin/toggle-lock/1',{locked:false});await ok('/admin/toggle-lock/1',{locked:false});
 token=userToken;let power=await ok('/power-boosters?match_id=1');assert.equal(power.uses[0].state,'RESERVED');assert.equal(power.can_cancel,true);assert.equal(power.uses.length,1);
 await ok('/power-boosters/cancel',{match_id:1,reservation_id:power.uses[0].reservation_id});
 t=await ok('/teams',draft);await ok('/power-boosters/apply',{match_id:1,team_id:t.team_id,lineup_revision:t.lineup_revision,role:'3X',player_id:508});
 // Simulate the scheduled start and real first delivery; then reopen after a verified score save.
 db.matches[0].match_date='2000-01-01T00:00:00Z';db.matches[0].first_delivery_at='2000-01-01T00:00:00Z';
 token=adminToken;await ok('/admin/toggle-lock/1',{locked:true});
 const stats=[{player_id:508,played_xi:true,dismissed:false,runs:50,balls:30,fours:5,sixes:2},{player_id:502,played_xi:true,dismissed:false,runs:25,balls:20,fours:2,sixes:0}];
 await ok('/admin/matches/1/stats',{stats,revision:0});
 token=userToken;const old=(await ok('/teams/my-team?match_id=1')).team;assert.ok(old.total_points>0);assert.equal(old.players.find(p=>p.id===508).multiplier,3);
 token=adminToken;await ok('/admin/toggle-lock/1',{locked:false});const open=(await ok('/matches'))[0];assert.equal(open.status,'LIVE');assert.equal(open.is_selectable,true);assert.equal(open.is_locked,false);assert.equal(open.selection_override,'OPEN');
 token=userToken;power=await ok('/power-boosters?match_id=1');assert.equal(power.can_cancel,true);
 await ok('/power-boosters/cancel',{match_id:1,reservation_id:power.uses[0].reservation_id});
 const canceled=(await ok('/teams/my-team?match_id=1')).team;assert.ok(canceled.total_points<old.total_points);
 t=await ok('/teams',{...draft,captain_id:508});let updated=(await ok('/teams/my-team?match_id=1')).team;assert.ok(updated.total_points!==canceled.total_points);
 await ok('/power-boosters/apply',{match_id:1,team_id:t.team_id,lineup_revision:t.lineup_revision,role:'3X',player_id:502});updated=(await ok('/teams/my-team?match_id=1')).team;
 assert.equal(updated.total_points,updated.players.reduce((n,p)=>n+p.effective_points,0));
 let lb=await ok('/leaderboard?match_id=1');assert.equal(lb.leaderboard[0].total_points,updated.total_points);assert.ok(lb.match.stats_updated_at);assert.equal(lb.match.score_revision,1);
 token=adminToken;await ok('/admin/toggle-lock/1',{locked:true});assert.equal((await ok('/matches'))[0].is_locked,true);
 token=userToken;assert.equal((await call('/teams',draft)).status,400);assert.equal((await ok('/power-boosters?match_id=1')).uses[0].state,'CONSUMED');
 token=adminToken;await ok('/admin/matches/1/stats',{stats,revision:1,finalize:true,result:'NO_RESULT'});assert.equal((await call('/admin/toggle-lock/1',{locked:false})).status,400);
 assert.equal((await ok('/matches'))[0].status,'COMPLETED');assert.ok(db.matches[0].selection_lock_history.length>=4);
 console.log('PASS admin reopen: authorization, qualification, repeatable lock/unlock, idempotence, past cutoff and LIVE override, preserved 3X inventory, live scoring/ranking reconciliation, finalization protection, audit history.');
 }catch(e){console.error(e);process.exitCode=1;}finally{server.close();}
});
