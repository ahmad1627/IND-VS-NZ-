import React, { useState } from 'react';
import api from '../api';
const ROLES = ['WK', 'BAT', 'AR', 'BOWL'];
const field = 'bg-slate-900 rounded p-2 text-sm';
export default function SquadAdmin() {
  const [data, setData] = useState({ players: [], matches: [], eligibility_locks: {}, locked_matches: [] });
  const [players, setPlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState({ search: '', team: '', role: '', match: '', active: '', availability: '' });
  const [editing, setEditing] = useState(null);
  const dirty = JSON.stringify(players) !== JSON.stringify(data.players);
  async function load() {
    setBusy(true);
    try {
      const { data: result } = await api.get('/admin/players');
      setData(result); setPlayers(result.players); setLoaded(true); setEditing(null);
    } catch (e) { setMessage(e.response?.data?.detail || 'Could not load players.'); }
    finally { setBusy(false); }
  }
  const locks = p => p.id == null ? (data.locked_matches || []) : (data.eligibility_locks?.[p.id] || []);
  function change(index, key, value) { setPlayers(current => current.map((p,i) => i === index ? { ...p, [key]: value } : p)); }
  function selectMatches(index, all) {
    const p = players[index];
    change(index, 'match_eligibility', data.matches.filter(m => locks(p).includes(m.id) ? p.match_eligibility.includes(m.id) : all).map(m => m.id));
  }
  async function save(undo = false) {
    if (undo && !window.confirm('Restore the last saved player edit for editable matches? New players will be deactivated, and locked matches preserved.')) return;
    const disruptive = players.some(p => { const old = data.players.find(x => x.id === p.id); return old && (old.role !== p.role || old.team !== p.team || old.active !== p.active || old.availability_status !== p.availability_status); });
    if (!undo && disruptive && !window.confirm('Apply these role, team or status changes to future selections? Saved teams remain, but managers may need to revise unlocked teams. Locked matches retain their original players.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await api.post(undo ? '/admin/players/undo' : '/admin/players', { revision: data.revision, ...(undo ? {} : { players: players.map(({ _key, ...p }) => p) }) });
      await load(); setMessage(response.data.message);
      window.dispatchEvent(new Event('fantasy-squad-updated'));
    } catch (e) { setMessage(e.response?.data?.detail || 'Could not save players. Your edits are still here.'); }
    finally { setBusy(false); }
  }
  function add() {
    setPlayers(current => [...current, { _key: `new-${Date.now()}-${current.length}`, name: '', team: 'PAK', role: 'BAT', active: true, availability_status: 'AVAILABLE', match_eligibility: data.matches.filter(m => !(data.locked_matches || []).includes(m.id)).map(m => m.id), external_player_id: '', photo_url: '' }]);
    setFilters({ search: '', team: '', role: '', match: '', active: '', availability: '' });
    setEditing(players.length);
  }
  const visible = players.map((p,index) => ({ p,index })).filter(({p}) => p.name.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.team || p.team === filters.team) && (!filters.role || p.role === filters.role) && (!filters.match || p.match_eligibility.includes(Number(filters.match))) && (!filters.active || (p.active !== false ? 'active' : 'inactive') === filters.active) && (!filters.availability || (p.availability_status || 'AVAILABLE') === filters.availability));
  function filter(key, options) { return <select aria-label={`Filter by ${key}`} className={field} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}><option value="">All {key}</option>{options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>; }
  return <details onToggle={e => { if (e.currentTarget.open && !loaded && !busy) load(); }} className="border-t border-slate-700 pt-3">
    <summary className="cursor-pointer font-bold">Manage Pakistan A / Sri Lanka A squads</summary>
    <p className="my-2 text-sm text-slate-300">Add and edit players for future selections. Locked matches keep their original roles, teams and availability. Match removal is also protected when a player is in a saved team.</p>
    {message && <p role="status" className="my-2 text-sm text-amber-200">{message}</p>}
    {busy && <p role="status">Loading / saving players…</p>}
    <fieldset disabled={busy || !loaded} className="space-y-3 min-w-0">
      <div className="flex flex-wrap gap-2">
        <input className={field} aria-label="Search players" placeholder="Search player name" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        {filter('team', [['PAK','Pakistan A'],['SL','Sri Lanka A']])}
        {filter('role', ROLES.map(r => [r,r]))}
        {filter('match', (data.matches || []).map(m => [m.id,m.title || `Match ${m.id}`]))}
        {filter('active', [['active','Active'],['inactive','Inactive']])}
        {filter('availability', ['AVAILABLE','MONITORING','OUT'].map(s => [s,s]))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="border rounded p-2" onClick={add}>Add New Player</button>
        <button type="button" className="border rounded p-2" onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and refresh?')) load(); }}>Refresh Player List</button>
        <button type="button" className="border rounded p-2" disabled={!dirty} onClick={() => { setPlayers(data.players); setEditing(null); setMessage('Unsaved changes cancelled.'); }}>Cancel Changes</button>
        <button type="button" className="border rounded p-2" disabled={!data.can_undo || dirty} onClick={() => save(true)}>Undo Last Saved Edit</button>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full text-sm text-left"><thead><tr>{['Player Name','Team','Role','Match Availability','Status','External ID / Photo','Actions'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>
          {visible.map(({p,index}) => <tr key={p.id ?? p._key} className="border-t border-slate-800 align-top bg-slate-950/60">
            <td className="p-2"><input aria-label={`${p.name || "New player"} name`} className={field} value={p.name} onChange={e => change(index,'name',e.target.value)} /><div className="text-xs text-slate-400">{p.id ? `ID ${p.id}` : 'New player • ID assigned on save'}</div></td>
            <td className="p-2"><select aria-label={`${p.name} team`} className={field} value={p.team} onChange={e => change(index,'team',e.target.value)}><option>PAK</option><option>SL</option></select></td>
            <td className="p-2"><select aria-label={`${p.name} role`} className={field} value={p.role} onChange={e => change(index,'role',e.target.value)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></td>
            <td className="p-2 min-w-60"><div className="flex flex-wrap gap-2">{(data.matches || []).map(m => <label key={m.id} title={m.title} className="flex items-center gap-1 p-1"><input type="checkbox" aria-label={`${p.name} 50-over ${m.id}`} disabled={locks(p).includes(m.id)} checked={p.match_eligibility.includes(m.id)} onChange={e => change(index,'match_eligibility',e.target.checked ? [...p.match_eligibility,m.id].sort((a,b) => a-b) : p.match_eligibility.filter(id => id !== m.id))} />50-over {m.id}{locks(p).includes(m.id) ? ' 🔒' : ''}</label>)}</div><button type="button" className="text-amber-300 underline mr-3" onClick={() => selectMatches(index,true)}>Select All</button><button type="button" className="text-amber-300 underline" onClick={() => selectMatches(index,false)}>Deselect All</button></td>
            <td className="p-2"><label className="flex gap-2"><input aria-label={`${p.name} active`} type="checkbox" checked={p.active !== false} onChange={e => change(index,'active',e.target.checked)} />{p.active !== false ? 'Active' : 'Inactive'}</label><select aria-label={`${p.name} availability`} className={field} value={p.availability_status || 'AVAILABLE'} onChange={e => change(index,'availability_status',e.target.value)}>{['AVAILABLE','MONITORING','OUT'].map(s => <option key={s}>{s}</option>)}</select></td>
            <td className="p-2 space-y-2"><input aria-label={`${p.name} external provider ID`} placeholder="External ID (optional)" className={field} value={p.external_player_id || ''} onChange={e => change(index,'external_player_id',e.target.value)} />{editing === index && <><input aria-label={`${p.name} photo URL`} placeholder="HTTPS photo URL (optional)" className={field} value={p.photo_url || ''} onChange={e => change(index,'photo_url',e.target.value)} /><input aria-label={`${p.name} availability note`} placeholder="Availability note" className={field} value={p.availability_note || ''} onChange={e => change(index,'availability_note',e.target.value)} /></>}</td>
            <td className="p-2"><button type="button" className="text-amber-300 underline" onClick={() => setEditing(editing === index ? null : index)}>Edit / Manage Matches</button></td>
          </tr>)}
        </tbody></table>
        {loaded && !visible.length && <p>No matching players.</p>}
      </div>
      <button type="button" className="bg-amber-400 text-slate-950 rounded p-2 font-bold" onClick={() => save()}>Save squad / availability changes</button>
      {dirty && <span className="ml-3 text-amber-200">Unsaved changes</span>}
    </fieldset>
  </details>;
}
