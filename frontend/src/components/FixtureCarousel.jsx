import React from 'react';
import { Calendar, MapPin, Lock, CheckCircle2, PlayCircle, Clock, Trophy } from 'lucide-react';

const FixtureCarousel = ({ matches = [], selectedMatch, onSelectMatch }) => {
  const teamInfo = {
    PAK: { flag: '🇵🇰', name: 'Pakistan A' },
    SL: { flag: '🇱🇰', name: 'Sri Lanka A' },
    AUS: { flag: '🇦🇺', name: 'Australia' },
    ENG: { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England' }
  };

  const dateLabel = (value, timezone) => {
    try {
      return new Date(value).toLocaleString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'Asia/Qatar',
        timeZoneName: 'short'
      });
    } catch {
      return new Date(value).toUTCString();
    }
  };

  return (
    <section className="fixture-carousel-shell w-full bg-[#101827]/90 border border-slate-900/60 rounded-2xl p-4 sm:p-5 shadow-xl mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            ACC Men&apos;s Asia Cup Rising Stars 2026 — Grand Final
          </h2>
        </div>
        <span className="text-xs text-slate-300">
          50-Over Tournament Final • Times shown in local stadium time
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {matches.map((match) => {
          const selected = selectedMatch?.id === match.id;
          const completed = match.status === 'COMPLETED';
          const locked = match.is_locked;
          const a = teamInfo[match.team_a] || { flag: '🇵🇰', name: match.team_a };
          const b = teamInfo[match.team_b] || { flag: '🇱🇰', name: match.team_b };

          return (
            <button
              type="button"
              aria-pressed={selected}
              key={match.id}
              onClick={() => onSelectMatch(match)}
              className={`fixture-card text-left rounded-xl p-4 border transition-all ${
                selected
                  ? 'bg-slate-800/90 border-amber-400 ring-1 ring-amber-400'
                  : completed
                    ? 'bg-slate-900/70 border-slate-700'
                    : locked
                      ? 'bg-amber-950/40 border-amber-600/70'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-500'
              }`}
            >
              <div className="flex justify-between items-center gap-2 mb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  GRAND FINAL (50-OVER)
                </span>
                <span className="text-[10px] font-bold">
                  {completed ? (
                    <span className="text-slate-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Final Result
                    </span>
                  ) : match.status === 'LIVE' ? (
                    <span className="text-red-400 animate-pulse flex items-center gap-1">
                      ● LIVE · {locked ? 'LINEUPS LOCKED' : 'SELECTION OPEN'}
                    </span>
                  ) : match.team_selection_disabled ? (
                    <span className="text-amber-300">Awaiting qualification</span>
                  ) : locked ? (
                    <span className="text-amber-300 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Lineup Locked
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" /> Selection Open
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 max-w-md mx-auto">
                <div className="text-center flex-1">
                  <div className="text-3xl mb-1">{a.flag}</div>
                  <div className="text-sm font-black text-emerald-400">{a.name}</div>
                  <span className="text-[10px] text-slate-400 font-bold">PAK</span>
                </div>
                <div className="flex flex-col items-center px-4">
                  <span className="text-xs text-amber-400 font-black px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
                    VS
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold mt-1">FINAL</span>
                </div>
                <div className="text-center flex-1">
                  <div className="text-3xl mb-1">{b.flag}</div>
                  <div className="text-sm font-black text-blue-400">{b.name}</div>
                  <span className="text-[10px] text-slate-400 font-bold">SL</span>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-2 mt-1 flex flex-wrap justify-between items-center text-xs text-slate-300 gap-2">
                <div className="flex items-center gap-1.5 text-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {dateLabel(match.match_date, match.local_timezone)} / {dateLabel(match.match_date, "Asia/Karachi")} PKT
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {match.venue}
                </div>
              </div>

              {match.winner_team && (
                <div className="mt-2 text-xs text-amber-300 font-bold">
                  Winner: {match.winner_team} ({match.scorecard_summary || 'Result announced'})
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default FixtureCarousel;
