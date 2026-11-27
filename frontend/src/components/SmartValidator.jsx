import React,{useState,useEffect,useRef} from 'react';
import api from '../api';
export default function SmartValidator({match,players,captainId,viceCaptainId,errors,locked,user}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const signature=JSON.stringify([match?.id,players.map(p=>p.id),captainId,viceCaptainId,locked]);
 const current=useRef(signature);current.current=signature;
 useEffect(()=>{setResult(null);},[signature]);
 async function verify(){const requested=signature;setBusy(true);try{const r=await api.post('/engagement/validate',{match_id:match.id,player_ids:players.map(p=>p.id),captain_id:captainId,vice_captain_id:viceCaptainId});if(current.current===requested)setResult(r.data.valid?'Server validation passed. Ready to submit while selection stays open.':r.data.errors.join(' '));}catch(e){if(current.current===requested)setResult(e.response?.data?.detail||'Validation failed. Please retry.');}finally{setBusy(false);}}
 return <details className="eng-validator"><summary>Team readiness · {players.length}/11 · {locked?'Locked':errors.length?'Incomplete':'Ready for server check'}</summary><p>WK 1–4 · BAT 3–6 · AR 1–4 · BOWL 3–6 · Maximum 7 per country</p><p>Captain: {captainId?'Selected':'Missing'} · Vice-captain: {viceCaptainId?'Selected':'Missing'}</p>{errors.length>0&&<ul>{errors.map(e=><li key={e}>{e}</li>)}</ul>}<button disabled={busy||!user||!match||locked} onClick={verify}>{busy?'Checking…':'Check with server'}</button>{!user&&<p>Sign in to verify your draft.</p>}{result&&<p role="status">{result}</p>}</details>;
}
