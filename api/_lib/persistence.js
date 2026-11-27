require('./config');
const { Redis } = require('@upstash/redis');
const { randomUUID } = require('crypto');
const { performance } = require('node:perf_hooks');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const hosted = Boolean(process.env.VERCEL) || process.env.REQUIRE_REDIS === 'true';
const LEGACY_STATE_KEY = process.env.LEGACY_GAME_NAMESPACE || 'fantasy-cricket:tri-series:2026';
const DEFAULT_STATE_KEY = 'fantasy-cricket:ind-nz-odi:2026';
// Never write the new competition over the old default Pakistan-series key.
const configuredStateKey = process.env.GAME_NAMESPACE;
const STATE_KEY = (!configuredStateKey || configuredStateKey === LEGACY_STATE_KEY) ? DEFAULT_STATE_KEY : configuredStateKey;
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_TOKEN;
const hasRedis = Boolean(url && token);
const redis = hasRedis ? new Redis({url, token, automaticDeserialization:false}) : null;
const localPath = path.resolve(process.env.LOCAL_DATA_FILE || path.join(__dirname, '../data/ind-nz-odi.json'));
const legacyLocalPath = path.resolve(process.env.LEGACY_LOCAL_DATA_FILE || path.join(__dirname, '../data/game.json'));
function freshStateFromLegacy(legacy) {
 db.restore(legacy);
 return db.snapshot();
}
const memoryOnly = process.env.NODE_ENV === 'test' && !process.env.LOCAL_DATA_FILE;
// Acquire the same lease and read its protected snapshot in one atomic round trip.
const ACQUIRE = "if redis.call('SET',KEYS[2],ARGV[1],'NX','PX',ARGV[2]) then return {1,redis.call('GET',KEYS[1]) or ''} end return {0,''}";
const RELEASE = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";
const COMMIT = "if redis.call('GET',KEYS[2]) ~= ARGV[3] then return 0 end if (redis.call('GET',KEYS[1]) or '') ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2]); return 1";
function missingConfiguration() {
 const missing = ['JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD'].filter(k => !process.env[k]);
 if (!hasRedis) missing.push('UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN');
 if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (minimum 32 characters)');
 if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 10) missing.push('ADMIN_PASSWORD (minimum 10 characters)');
 return missing;
}
const pause = ms => new Promise(r => setTimeout(r,ms));
// The model is mutable, so serialize requests inside each process as well as
// locking Redis writes across serverless instances. Never fall back to /tmp.
let queue = Promise.resolve();
function persistence(req,res,next) {
 if(req.fantasyPersistenceActive)return next();
 req.fantasyPersistenceActive=true;
 const queuedAt=performance.now();
 const timing={};
 res.set('Cache-Control','private, no-store');
 const previous = queue;
 let done;
 queue = new Promise(resolve => { done=resolve; });
 previous.then(async () => {
  timing.queue=performance.now()-queuedAt;
  const storageStarted=performance.now();
  let handlerStarted;
  let lock=null, original=null, before=null;
  const nativeJson=res.json.bind(res);
  const release=async()=>{ if(lock && redis){const held=lock;lock=null;await redis.eval(RELEASE,[STATE_KEY+':lock'],[held]);} };
  let completed=false;
  const finish=async()=>{if(completed)return;completed=true;await release().catch(()=>{});done();};
  res.once('finish',finish);
  // Wait for commit to settle even when the requesting browser disconnects.
  try {
   if(hosted && missingConfiguration().length) {
    res.status(503);return nativeJson({detail:'Server configuration is incomplete. Administrator must configure credentials and persistent Redis storage.',missing_environment_variables:missingConfiguration()});
   }
   if(redis){
    { // Reads also reconcile time-based locks durably under the same lease.
     lock=randomUUID();const until=Date.now()+4000;
     const lockStarted=performance.now();
     let attemptStarted=lockStarted;
     let acquired=await redis.eval(ACQUIRE,[STATE_KEY,STATE_KEY+':lock'],[lock,15000]);
     while(Number(acquired[0])!==1){
      if(Date.now()>until){lock=null;res.set('Retry-After','2');res.status(503);return nativeJson({detail:'Game is busy. Changes were not saved. Please retry.'});}
      await pause(50);
      attemptStarted=performance.now();
      acquired=await redis.eval(ACQUIRE,[STATE_KEY,STATE_KEY+':lock'],[lock,15000]);
     }
     timing.lock_wait=attemptStarted-lockStarted;
     timing.lease_snapshot=performance.now()-attemptStarted;
     original=acquired[1] || null;
    }
    if(original==null){
     const legacyRaw=await redis.get(LEGACY_STATE_KEY);
     const legacy=legacyRaw==null?null:(typeof legacyRaw==='string'?JSON.parse(legacyRaw):legacyRaw);
     const initial=JSON.stringify(legacy?freshStateFromLegacy(legacy):db.snapshot());
     await redis.set(STATE_KEY,initial,{nx:true});
     original=await redis.get(STATE_KEY);
    }
    db.restore(typeof original==='string'?JSON.parse(original):original);
   } else if(!memoryOnly) {
    if(fs.existsSync(localPath)) db.restore(JSON.parse(fs.readFileSync(localPath,'utf8')));
    else if(fs.existsSync(legacyLocalPath)) {
     const legacy=JSON.parse(fs.readFileSync(legacyLocalPath,'utf8'));
     const migrated=JSON.stringify(freshStateFromLegacy(legacy));
     fs.mkdirSync(path.dirname(localPath),{recursive:true});
     fs.writeFileSync(localPath,migrated,{mode:0o600});
     db.restore(JSON.parse(migrated));
    }
   }
   timing.storage=performance.now()-storageStarted;
   const snapshotStarted=performance.now();
   before=JSON.stringify(db.snapshot());
   require('./boosterLifecycle').reconcile(db);
   const reconciled = JSON.stringify(db.snapshot());
   timing.snapshot=performance.now()-snapshotStarted;
   handlerStarted=performance.now();
   let sending=false;
   res.json=body=>{
    if(sending)return res;sending=true;
    timing.handler=performance.now()-handlerStarted;
    const serializeStarted=performance.now();
    if(res.statusCode>=400) db.restore(JSON.parse(reconciled));
    require('./boosterLifecycle').reconcile(db);
    const updated=JSON.stringify(db.snapshot());
    const changed=updated!==before;
    timing.serialize=performance.now()-serializeStarted;
    void (async()=>{
     try{
      const commitStarted=performance.now();
      if(changed){
       if(redis){
        const result=await redis.eval(COMMIT,[STATE_KEY,STATE_KEY+':lock'],[typeof original==='string'?original:JSON.stringify(original),updated,lock]);
        if(result!==1) throw Error('Write lease or state changed');
       }else if(!memoryOnly){
        fs.mkdirSync(path.dirname(localPath),{recursive:true});
        const temp=localPath+'.tmp';fs.writeFileSync(temp,updated,{mode:0o600});fs.renameSync(temp,localPath);
       }
      }
      // Successful commit is authoritative even if lock cleanup fails.
      await release().catch(()=>{});
      timing.commit_release=performance.now()-commitStarted;
      res.set('Server-Timing',Object.entries(timing).map(([name,ms])=>`${name};dur=${ms.toFixed(2)}`).join(', '));
      nativeJson(body);
     }catch(error){
      db.restore(JSON.parse(before));
      await release().catch(()=>{});
      res.status(503);nativeJson({detail:'Save could not be confirmed. Reload your team before retrying.'});
     }finally{await finish();}
    })();
    return res;
   };
   next();
  }catch(error){
   if(before) db.restore(JSON.parse(before));
   res.status(503);nativeJson({detail:'Game database unavailable. No save was confirmed. Please retry shortly.'});
  }finally{
   if(res.writableEnded) await finish();
  }
 }).catch(()=>{done();if(!res.headersSent)res.status(503).json({detail:'Game unavailable. Please retry.'});});
}
module.exports={persistence,missingConfiguration,redis,hasRedis,STATE_KEY};
