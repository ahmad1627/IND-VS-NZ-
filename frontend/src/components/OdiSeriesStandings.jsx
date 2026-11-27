import React, { useEffect, useState } from 'react';
import api from '../api';

const OdiSeriesStandings = () => {
  const [rows, setRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/standings'), api.get('/matches')])
      .then(([s, m]) => {
        setRows(s.data);
        setMatches(m.data);
      })
      .catch(() => setError('Could not load tournament data.'));
  }, []);

  const name = { PAK: 'Pakistan A', SL: 'Sri Lanka A', AUS: 'Australia', ENG: 'England' };
  const flag = { PAK: '🇵🇰', SL: '🇱🇰', AUS: '🇦🇺', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' };

  return (
    <section className="series-standings-shell bg-[#101827] border border-slate-900 rounded-2xl p-5 text-white">
      <h2 className="text-xl font-black text-amber-300">ACC Men&apos;s Asia Cup Rising Stars 2026 — Final</h2>
      <p className="text-xs text-slate-400 mt-1 mb-5">
        Tournament final standings are calculated from official match results.
      </p>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {rows.map(r => (
          <div key={r.team} className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
            <div className="text-lg font-bold flex items-center gap-2">
              <span>{flag[r.team] || '🏏'}</span>
              <span>{name[r.team] || r.team}</span>
            </div>
            <div className="text-sm text-slate-300 mt-2">
              Played {r.played} · Won {r.won} · Lost {r.lost} · Points {r.points} · NRR {r.nrr || 0}
            </div>
          </div>
        ))}
      </div>
      <h3 className="font-bold text-amber-200 mb-3">Championship Match</h3>
      <div className="space-y-2">
        {matches.map(m => (
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <strong className="text-sm">{m.title}</strong>
            <span className="text-xs text-slate-400">
              {new Date(m.match_date).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: m.local_timezone || 'Asia/Qatar'
              })} venue local · {m.venue}
            </span>
            <span className="text-xs text-slate-300 font-bold">{m.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OdiSeriesStandings;
