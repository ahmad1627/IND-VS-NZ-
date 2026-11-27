const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLiveScores } = require('../api/_lib/liveScores');
const valid = { status: 'success', data: [{id:'a',matchType:'odi',teams:['Pakistan A','Sri Lanka A'],date:'2026-11-29',score:[{inning:'Pakistan A',r:150,w:3,o:18.2}],status:'Live'}, {id:'b',matchType:'odi',teams:['Australia','England']}] };
test('missing key never calls provider', async () => {
 const get = createLiveScores({fetcher:()=>{throw Error('Unexpected network');}});
 assert.equal((await get()).state,'disabled');
});
test('deduplicates concurrent requests, filters matches and falls back on provider error', async () => {
 let calls=0, clock=1000000, fail=false;
 const get=createLiveScores({key:'test',now:()=>clock,fetcher:async()=>{calls++;if(fail)throw Error('timeout');return {ok:true,json:async()=>valid};}});
 const responses=await Promise.all(Array.from({length:20},()=>get()));
 assert.equal(calls,1);assert.equal(responses[0].matches.length,1);assert.equal(responses[0].matches[0].scores[0].runs,150);
 clock+=900001;fail=true;assert.equal((await get()).state,'stale');await get();assert.equal(calls,2);
});
test('invalid payload is unavailable, no retry storm',async()=>{
 let calls=0;const get=createLiveScores({key:'test',fetcher:async()=>{calls++;return {ok:true,json:async()=>({status:'failure'})};}});
 assert.equal((await get()).state,'unavailable');await get();assert.equal(calls,1);
});
test('shared cache prevents duplicate calls across instances',async()=>{
 const store=new Map();const redis={get:async k=>store.get(k),set:async(k,v,o)=>{if(o.nx&&store.has(k))return null;store.set(k,v);return 'OK';}};
 let calls=0;const options={key:'test',redis,fetcher:async()=>{calls++;return {ok:true,json:async()=>valid};}};
 await Promise.all([createLiveScores(options)(),createLiveScores(options)()]);assert.equal(calls,1);
 assert.equal((await createLiveScores(options)()).state,'available');assert.equal(calls,1);
});
test('Redis outage fails safely without consuming API quota',async()=>{
 const get=createLiveScores({key:'test',redis:{get:async()=>{throw Error('offline');}},fetcher:async()=>{throw Error('must not call');}});
 assert.equal((await get()).state,'unavailable');
});
