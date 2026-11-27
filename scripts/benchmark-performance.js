// Isolated synthetic benchmark. Never connects to or writes the real database.
process.env.NODE_ENV='test';process.env.JWT_SECRET='synthetic-performance-secret-at-least-32';
process.env.UPSTASH_REDIS_REST_URL='https://synthetic.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='synthetic';
delete process.env.ADMIN_EMAIL;delete process.env.ADMIN_PASSWORD;
const {performance}=require('node:perf_hooks');
const values=new Map();let calls=0,redisMs=0;
const delay=Number(process.env.BENCH_REDIS_MS||0);
async function tick(){calls++;const t=performance.now();if(delay)await new Promise(r=>setTimeout(r,delay));redisMs+=performance.now()-t;}
class FakeRedis {
 async get(k){await tick();return values.get(k)??null;}
 async set(k,v,o={}){await tick();if(o.nx&&values.has(k))return null;values.set(k,v);return 'OK';}
 async eval(s,k,a){await tick();if(s.includes("'NX','PX'")){if(values.has(k[1]))return [0,''];values.set(k[1],a[0]);return [1,values.get(k[0])||''];}if(k.length===1){if(values.get(k[0])===a[0])values.delete(k[0]);return 1;}if(values.get(k[1])!==a[2]||values.get(k[0])!==a[0])return 0;values.set(k[0],a[1]);return 1;}
}
require.cache[require.resolve('@upstash/redis')]={exports:{Redis:FakeRedis}};
const db=require('../api/_lib/database');
const count=Number(process.env.BENCH_USERS||1000);
const ids=[310,305,306,309,401,301,403,407,302,406,413];
for(const m of db.matches){m.match_date='2099-01-01T00:00:00Z';m.is_locked=true;}
for(let i=0;i<count;i++){const id=i+100;db.users.push({id,email:`bench${id}@example.test`,full_name:`Manager ${id}`,fantasy_team_name:`XI ${id}`});for(const m of db.matches)db.fantasyTeams.push({id:db.fantasyTeams.length+1,user_id:id,match_id:m.id,player_ids:ids,captain_id:305,vice_captain_id:306,total_points:i%57,rank:1});}
require('../api/_lib/boosterLifecycle').reconcile(db);
const {STATE_KEY}=require('../api/_lib/persistence');values.set(STATE_KEY,JSON.stringify(db.snapshot()));
let restoreMs=0,handlerMs=0;
const restore=db.restore.bind(db);db.restore=(state)=>{const start=performance.now();try{return restore(state);}finally{restoreMs+=performance.now()-start;}};
const app=require('../api/_lib/app');
const visited=new Set();
for(const layer of app._router.stack){
 if(!layer.handle?.stack || visited.has(layer.handle))continue;visited.add(layer.handle);
 for(const route of layer.handle.stack){
  if(!route.route?.path.startsWith('/leaderboard'))continue;
  const stack=route.route.stack, target=stack[stack.length-1], handler=target.handle;
  target.handle=(req,res,next)=>{
   const start=performance.now(), json=res.json;
   res.json=function(body){handlerMs+=performance.now()-start;res.json=json;return json.call(this,body);};
   return handler(req,res,next);
  };
 }
}
if(process.env.BENCH_PORT){app.listen(Number(process.env.BENCH_PORT),'127.0.0.1',()=>console.log('Isolated benchmark server ready'));}
else {
const server=app.listen(0,'127.0.0.1',async()=>{
 const base=`http://127.0.0.1:${server.address().port}/api`;const out={users:count,teams:db.fantasyTeams.length,redis_command_delay_ms:delay,snapshot_bytes:Buffer.byteLength(values.get(STATE_KEY)),routes:{}};
 const authToken=require('jsonwebtoken').sign({sub:'100',version:0},process.env.JWT_SECRET);const headers={Authorization:'Bearer '+authToken,'Content-Type':'application/json'};
 try{for(const route of ['/leaderboard/overall','/leaderboard?match_id=1','/leaderboard/team/1','/matches','/matches/1/players','/teams/my-team?match_id=1','/power-boosters?match_id=1']){
 const times=[];let bytes,cold,commands,storage,serverTiming,hash;const handlers=[],restores=[];
 for(let i=0;i<11;i++){calls=0;redisMs=0;handlerMs=0;restoreMs=0;const start=performance.now();const r=await fetch(base+route,{headers});const body=await r.text();if(r.status!==200)throw Error(body);const elapsed=performance.now()-start;if(i===0)cold=elapsed;else times.push(elapsed);handlers.push(handlerMs);restores.push(restoreMs);hash=require('crypto').createHash('sha256').update(body).digest('hex');bytes=Buffer.byteLength(body);commands=calls;storage=redisMs;serverTiming=r.headers.get('server-timing');}
 times.sort((a,b)=>a-b);out.routes[route]={cold_ms:+cold.toFixed(2),median_ms:+times[5].toFixed(2),p90_ms:+times[9].toFixed(2),bytes,redis_commands:commands,last_redis_ms:+storage.toFixed(2),server_timing:serverTiming,response_sha256:hash,median_handler_ms:+handlers.slice(1).sort((a,b)=>a-b)[5].toFixed(2),median_restore_ms:+restores.slice(1).sort((a,b)=>a-b)[5].toFixed(2)};
 }
 const start=performance.now();out.concurrent_response_timings=await Promise.all(['/matches','/leaderboard/overall','/leaderboard/team/1'].map(async p=>{const r=await fetch(base+p);await r.text();return {route:p,server_timing:r.headers.get('server-timing')};}));out.concurrent_three_ms=+(performance.now()-start).toFixed(2);
 // Exercise mutations only in this disposable, in-memory Redis double.
 const unlocked=JSON.parse(values.get(STATE_KEY));
 for(const m of unlocked.matches){m.is_locked=false;m.status='ACTIVE';delete m.booster_locked_at;delete m.booster_lock_reason;}
 values.set(STATE_KEY,JSON.stringify(unlocked));
 const writes={save:[],apply:[],cancel:[]};
 async function post(route,body){calls=0;const t=performance.now();const r=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(body)});const data=await r.json();if(r.status!==200)throw Error(JSON.stringify(data));return {data,ms:+(performance.now()-t).toFixed(2),redis_round_trips:calls};}
 for(let i=0;i<5;i++){
  const saved=await post('/teams',{match_id:1,player_ids:ids,captain_id:i%2?306:305,vice_captain_id:i%2?305:306});writes.save.push(saved.ms);
  const applied=await post('/power-boosters/apply',{match_id:1,team_id:saved.data.team_id,lineup_revision:saved.data.lineup_revision,role:'BAT'});writes.apply.push(applied.ms);
  const reservation=JSON.parse(values.get(STATE_KEY)).powerBoosterUses.find(u=>u.user_id===100&&u.match_id===1).reservation_id;
  const canceled=await post('/power-boosters/cancel',{match_id:1,reservation_id:reservation});writes.cancel.push(canceled.ms);
  out.write_redis_round_trips={save:saved.redis_round_trips,apply:applied.redis_round_trips,cancel:canceled.redis_round_trips};
 }
 out.write_medians_ms=Object.fromEntries(Object.entries(writes).map(([key,ms])=>[key,ms.sort((a,b)=>a-b)[2]]));
 console.log(JSON.stringify(out,null,2));
 }finally{server.close();}
});

}
