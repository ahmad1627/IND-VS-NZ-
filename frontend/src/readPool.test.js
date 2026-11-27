import { describe, it, expect, vi } from 'vitest';
import { createReadPool } from './readPool';
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; };
describe('in-flight reads (no persistent response cache)', () => {
 it('shares repeated clicks but refetches a completed response',async()=>{
  const d=deferred(), fetch=vi.fn(()=>d.promise), pool=createReadPool(fetch,()=> 'a');
  const a=pool.get('/team/1'),b=pool.get('/team/1');await Promise.resolve();expect(fetch).toHaveBeenCalledTimes(1);
  d.resolve({points:1});expect(await a).toEqual(await b);await pool.get('/team/1');expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('isolates matches, teams and authorization contexts',async()=>{
  let token='a';const d=deferred();const pool=createReadPool(()=>d.promise,()=>token);
  const a=pool.get('/team/1',{params:{match_id:1}}).catch(e=>e.code);token='b';const b=pool.get('/team/1',{params:{match_id:2}});d.resolve({ok:true});
  expect(await a).toBe('ERR_CANCELED');expect(await b).toEqual({ok:true});
 });
 it('cancels obsolete consumers without canceling another live subscriber',async()=>{
  const d=deferred();let signal;const pool=createReadPool((u,c)=>{signal=c.signal;return d.promise;},()=> 'a');
  const c=new AbortController();const a=pool.get('/team/1',{signal:c.signal}).catch(e=>e.code);const b=pool.get('/team/1');await Promise.resolve();c.abort();expect(await a).toBe('ERR_CANCELED');expect(signal.aborted).toBe(false);d.resolve('latest');expect(await b).toBe('latest');
 });
 it('aborts transport when all subscribers leave and rejects cleared results',async()=>{
  const d=deferred();let signal;const pool=createReadPool((u,c)=>{signal=c.signal;return d.promise;},()=> 'a');const c=new AbortController();
  const a=pool.get('/team/1',{signal:c.signal}).catch(e=>e.code);await Promise.resolve();c.abort();expect(await a).toBe('ERR_CANCELED');expect(signal.aborted).toBe(true);d.resolve('obsolete');
  const e=deferred();const other=createReadPool(()=>e.promise,()=> 'a');const b=other.get('/team/2').catch(e=>e.code);other.clear();e.resolve('old');expect(await b).toBe('ERR_CANCELED');
 });
 it('retries errors and does not cache corrected points',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({points:10}).mockResolvedValueOnce({points:12});const pool=createReadPool(fetch,()=> 'a');
  await expect(pool.get('/team/1')).rejects.toThrow('offline');expect(await pool.get('/team/1')).toEqual({points:10});expect(await pool.get('/team/1')).toEqual({points:12});
 });
});
