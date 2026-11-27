import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, WandSparkles, Crown } from 'lucide-react';
import { teamColors } from '../utils/teamColors';

export default function AiFantasyAssistant({players, selected, match, reservedBoosterId, locked, busy, onApply}) {
  const [result,setResult]=useState(null), [loading,setLoading]=useState(false), [error,setError]=useState('');
  const request=useRef(null);
  const publicPlayers=players.filter(p=>p.active!==false && p.availability_status!=='OUT').map(({id,name,team,role,active,availability_status,playing_xi_confirmed})=>({id,name,team,role,active,availability_status,playing_xi_confirmed}));
  const signature=JSON.stringify([match?.id,publicPlayers,selected.map(p=>p.id),reservedBoosterId]);
  useEffect(()=>{setResult(null);setError('');setLoading(false);return ()=>{const prior=request.current;request.current=null;prior?.abort();};},[signature]);
  if (!match || !players.length || !['PAK','SL'].includes(match.team_a) || !['PAK','SL'].includes(match.team_b) || import.meta.env.VITE_AI_ENABLED==='false') return null;
  async function analyze(){
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setLoading(true);setError('');setResult(null);
    const timeout=setTimeout(()=>controller.abort(),6500);
    try{
      const base=(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/,'');
      const response=await fetch(`${base}/ai-recommend`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({players:publicPlayers,selected_ids:selected.map(p=>p.id),reserved_booster_id:reservedBoosterId||null})});
      if(!response.ok)throw Error('AI recommendations are temporarily unavailable. You can still build your XI manually.');
      const data=await response.json();
      if(request.current===controller&&!controller.signal.aborted)setResult({data,signature});
    }catch(e){if(request.current===controller)setError(controller.signal.aborted?'AI request timed out or was cancelled. Try again.':e.message);}
    finally{clearTimeout(timeout);if(request.current===controller)setLoading(false);}
  }
  const data=result?.signature===signature?result.data:null;
  const byId=new Map(players.map(p=>[p.id,p]));
  const row=(id,label)=> <div key={label} className="bg-slate-950/70 border border-slate-700 rounded-lg p-2"><span className="block text-[10px] text-amber-300 font-bold uppercase">{label}</span><strong className="text-xs text-white">{byId.get(id)?.name||'Unavailable'}</strong></div>;
  const leaders=(l)=><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{row(l.captain_id,'Captain · 2×')}{row(l.vice_captain_id,'Vice-captain · 1.5×')}{row(l.booster_id,'3X · optional')}</div>;
  return <section aria-label="AI Fantasy Intelligence" className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-[#101827] to-blue-950 p-4 sm:p-5 shadow-xl space-y-3">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/15 text-emerald-300 p-3"><Sparkles size={22}/></div><div className="flex-1"><h2 className="text-white font-black text-sm sm:text-base">AI Fantasy Intelligence</h2><p className="text-slate-300 text-xs">Python-powered XI, leadership and smart picks</p></div></div>
    <p className="text-xs text-slate-300">Optional recommendations based on partial tournament form and squad roles. No guaranteed performance or automatic team submission.</p>
    <button type="button" disabled={loading||busy} onClick={analyze} className="w-full rounded-xl bg-emerald-400 text-slate-950 font-black py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"><WandSparkles size={16}/>{loading?'Analyzing squad…':'Analyze & suggest best XI'}</button>
    {error&&<p role="alert" className="text-xs text-amber-200">{error}</p>}
    {data&&<div className="space-y-4" aria-live="polite">
      <div className="text-xs text-slate-300 border border-slate-700 rounded-lg p-3"><strong className="text-emerald-300">Evidence coverage: {data.coverage}/{data.eligible_count} eligible players</strong><p className="mt-1">{data.snapshot} Other players use role-based fallback; absence of data does not mean poor form.</p>{data.sources?.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer" className="underline mr-3 text-sky-300">Source {i+1}</a>)}</div>
      {data.suggested_xi?.length===11 ? <><h3 className="font-black text-sm text-white">Suggested XI</h3><div className="grid grid-cols-2 gap-1.5">{data.suggested_xi.map(id=>{const p=byId.get(id);if(!p)return null;return <div key={id} className="flex items-center gap-2 rounded-lg p-2 border border-slate-700/80 bg-slate-950/60"><span className={`w-8 h-8 shrink-0 rounded-full border flex items-center justify-center text-[10px] font-bold ${teamColors(p.team)}`}>{p.role}</span><span className="text-xs text-white">{p.name}</span></div>;})}</div>{data.suggested_leadership&&leaders(data.suggested_leadership)}<button type="button" disabled={locked||busy||Boolean(reservedBoosterId)||!data.suggested_leadership} onClick={()=>onApply(data.suggested_xi,data.suggested_leadership)} className="w-full rounded-lg border border-emerald-400 text-emerald-200 font-bold py-2 text-xs disabled:opacity-40">Apply XI & leadership to draft</button></> : <p className="text-xs text-amber-200">No legal XI can be formed from the current eligible pool.</p>}
      {data.draft_leadership&&<><h3 className="text-sm font-black text-white flex gap-2"><Crown size={16} className="text-amber-300"/>Best leadership for your current XI</h3>{leaders(data.draft_leadership)}<button type="button" disabled={locked||busy} onClick={()=>onApply(selected.map(p=>p.id),data.draft_leadership)} className="w-full rounded-lg border border-amber-400 text-amber-200 font-bold py-2 text-xs disabled:opacity-40">Apply C / VC / 3X suggestion to draft</button></>}
      {reservedBoosterId&&<p className="text-xs text-amber-200">Your active 3X reservation stays unchanged. Cancel it through Power Boosters before replacing the XI.</p>}
      {locked&&<p className="text-xs text-amber-200">Read-only preview. Team selection is not open.</p>}
      <details className="border border-slate-700 p-3 rounded-lg"><summary className="cursor-pointer text-sm font-bold text-white">Smart picks by role & evidence</summary><div className="space-y-2 mt-3">{Object.entries(data.picks||{}).map(([role,picks])=><div key={role}><strong className="text-xs text-emerald-300">{role}</strong>{picks.map(p=><p key={p.id} className="text-xs text-slate-300 mt-1"><strong className="text-white">{p.name}</strong> — {p.evidence}</p>)}</div>)}</div></details>
    </div>}
  </section>;
}
