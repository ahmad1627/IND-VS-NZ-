// @vitest-environment jsdom
import {it,expect,beforeEach} from 'vitest';
import axios from 'axios';
import api,{clearPendingReads} from './api';
beforeEach(()=>{clearPendingReads();localStorage.clear();});
it('coalesces Axios requests and retries a read invalidated by a committed mutation',async()=>{
 let reads=0;
 api.defaults.adapter=config=>{
  if(config.method==='post')return Promise.resolve({data:{ok:true},status:200,headers:{},config});
  reads++;
  if(reads===1)return new Promise((resolve,reject)=>config.signal.addEventListener('abort',()=>reject(new axios.CanceledError()),{once:true}));
  return Promise.resolve({data:{points:25},status:200,headers:{},config});
 };
 const a=api.get('/leaderboard/team/1'),b=api.get('/leaderboard/team/1');
 await new Promise(r=>setTimeout(r,0));expect(reads).toBe(1);
 await api.post('/admin/matches/1/stats',{});
 expect((await a).data.points).toBe(25);expect((await b).data.points).toBe(25);expect(reads).toBe(2);
});
it('never retries a previous account read after logout',async()=>{
 localStorage.setItem('fantasy_auth_token','old-account');let resolve;
 api.defaults.adapter=config=>new Promise(r=>{resolve=()=>r({data:{private:true},status:200,headers:{},config});});
 const result=api.get('/leaderboard/team/1').catch(e=>e.code);
 await new Promise(r=>setTimeout(r,0));clearPendingReads();localStorage.removeItem('fantasy_auth_token');resolve();
 expect(await result).toBe('ERR_CANCELED');
});
