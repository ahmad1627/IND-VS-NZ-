import React, { useEffect, useState } from 'react';
import api from '../api';
export default function LiveScores({ match }) {
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      if (document.hidden) return;
      try { const result = await api.get('/live-scores', { signal: controller.signal }); if (active) setFeed(result.data); }
      catch { if (active) setFeed(previous => previous ? { ...previous, state: 'stale' } : { state: 'unavailable', matches: [] }); }
    };
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', load);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, []);
  if (!feed || feed.state === 'disabled') return null;
  const date = match?.match_date?.slice(0,10);
  const candidates = (feed.matches || []).filter(item => item.date === date);
  const current = candidates.length === 1 ? candidates[0] : null;
  return <section aria-label="Match scores" className="mb-4 rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-sm">
    <div className="flex flex-wrap justify-between gap-2"><strong className="text-amber-300">Match scores · CricketData.org</strong><span className="text-xs text-slate-300">Refresh: 15 minutes{feed.state === 'stale' ? ' · Last known scores' : ''}</span></div>
    {current ? <><p className="mt-2">{current.status}</p>{current.scores.map((s,i) => <p key={i}>{s.innings}: <strong>{s.runs}/{s.wickets}</strong> ({s.overs} overs)</p>)}</> : <p className="mt-2 text-slate-300">{feed.state === 'unavailable' || feed.state === 'stale' ? 'Score service temporarily unavailable.' : 'No provider score available for this fixture yet.'} Team selection remains available under the usual match rules.</p>}
    {feed.updated_at && <p className="mt-2 text-xs text-slate-400">Updated {new Date(feed.updated_at).toLocaleString()} · Fantasy points are managed separately by the administrator.</p>}
  </section>;
}
