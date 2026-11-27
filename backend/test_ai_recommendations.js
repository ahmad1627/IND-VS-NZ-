process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-ai-regression-test-secret';
const assert=require('node:assert/strict');
const db=require('../api/_lib/database');
const app=require('../api/_lib/app');
const composition=require('../api/_lib/teamComposition');
const server=app.listen(0,'127.0.0.1',async()=>{
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const call=async(body)=>{const r=await fetch(base+'/ai-recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const before=JSON.stringify(db.snapshot());const players=db.getPlayersForMatch(1);const raw={players,selected_ids:[]};
  let r=await call(raw);assert.equal(r.status,200,JSON.stringify(r));const d=r.data;
  assert.equal(d.suggested_xi.length,11);assert.equal(composition(db,db.getMatchById(1),d.suggested_xi),null);
  assert.equal(new Set(Object.values(d.suggested_leadership)).size,3);
  assert.ok(Object.values(d.suggested_leadership).every(id=>d.suggested_xi.includes(id)));
  assert.equal(d.coverage,10);assert.equal(d.eligible_count,30);
  assert.deepEqual((await call(raw)).data,d,'deterministic');
  r=await call({...raw,selected_ids:d.suggested_xi,reserved_booster_id:d.suggested_leadership.booster_id});
  assert.equal(r.data.draft_leadership.booster_id,d.suggested_leadership.booster_id);
  const outId=d.suggested_xi[0];r=await call({players:players.map(p=>p.id===outId?{...p,availability_status:'OUT'}:p),selected_ids:[]});
  assert.equal(r.status,200);assert.ok(!r.data.suggested_xi.includes(outId));
  assert.equal((await call({players:[players[0],players[0]]})).status,400);
  r=await call({players:players.filter(p=>p.role!=='WK'),selected_ids:[]});assert.equal(r.status,200);assert.deepEqual(r.data.suggested_xi,[]);
  process.env.AI_ENABLED='false';assert.equal((await call(raw)).status,503);delete process.env.AI_ENABLED;
  const old=process.env.PYTHON_COMMAND;process.env.PYTHON_COMMAND='nonexistent-python-test-binary';assert.equal((await call(raw)).status,503);if(old)process.env.PYTHON_COMMAND=old;else delete process.env.PYTHON_COMMAND;
  assert.equal(JSON.stringify(db.snapshot()),before,'AI cannot alter game state');
  assert.equal((await fetch(base+'/health')).status,200,'website survives Python failure');
  console.log('PASS AI: real HTTP Python integration, 11-player Node validation, distinct leadership, deterministic output, eligibility, no valid XI, malformed input, reservation protection, disabled/unavailable Python and database isolation.');
 }catch(e){console.error(e);process.exitCode=1;}finally{server.close();}
});
