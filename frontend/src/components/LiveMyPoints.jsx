import React, {useEffect,useState} from 'react';
import api from '../api';
// Only reads the saved team. Never overwrites an in-progress selection draft.
export default function LiveMyPoints({matchId,revision,updatedAt,savedSignature,boosterId,userId}) {
 const [team,setTeam]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController(); let active=true,busy=false;
  const refresh=()=>{if(!active||busy||document.hidden)return;busy=true;
  api.get(`/teams/my-team?match_id=${matchId}`,{signal:controller.signal}).then(({data})=>{if(active){setTeam(data.has_team?data.team:null);setError(false);}}).catch(()=>{if(active)setError(true);}).finally(()=>{busy=false;});};
  refresh();const timer=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[matchId,revision,savedSignature,boosterId,userId]);
 if(!team && !error)return null;
 return <section className="rounded-2xl bg-slate-950 border border-emerald-500/50 p-4 space-y-3" aria-label="Saved XI live fantasy points">
  <div className="flex justify-between items-center"><div><h3 className="font-black text-emerald-300">MY XI · LIVE FANTASY POINTS</h3><p className="text-xs text-slate-300">Admin-verified scorecard · Saved team only</p></div>{team&&<strong className="text-2xl text-white">{team.total_points} pts</strong>}</div>
  {error?<p role="alert" className="text-amber-300 text-xs">Could not refresh. Displayed points may be out of date.</p>:null}
  {team&&<><div className="text-xs text-slate-300">Rank: {team.rank??'—'} · Last score save: {updatedAt?new Date(updatedAt).toLocaleString():'Unknown'}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{team.players.map(p=><div key={p.id} className="flex justify-between gap-2 rounded-lg bg-slate-800 p-2 text-xs"><span>{p.name}{p.multiplier!==1?` · ${p.multiplier}X`:''}</span><strong>{p.effective_points} pts</strong></div>)}</div></>}
 </section>;
}
