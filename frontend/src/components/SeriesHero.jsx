import React, { useState } from 'react';
import { soundEnabled } from '../utils/fantasyAudio';
import { ArrowUpRight, ShieldCheck, Trophy, Sparkles } from 'lucide-react';

export default function SeriesHero({ onBuild, onLeaderboard, match }) {
  const [sound, setSound] = useState(soundEnabled);

  return (
    <section className="series-hero" aria-labelledby="series-title">
      <div className="hero-orbit" aria-hidden="true"><span>26</span></div>
      <div className="hero-copy">
        <p className="hero-eyebrow">
          <span /> ACC MEN&apos;S ASIA CUP RISING STARS 2026 • GRAND FINAL
        </p>
        <h1 id="series-title">
          <span>PAKISTAN A</span>
          <small>versus</small>
          <span>SRI LANKA A<span className="hero-period">.</span></span>
        </h1>
        <p className="hero-intro">
          50-Over Championship Clash in Doha.<br />
          One Grand Final. Your fantasy XI decides the champion.
        </p>
        <button
          className="text-xs text-slate-300 mt-3"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            try {
              localStorage.setItem('fantasy_sound', next ? 'on' : 'off');
            } catch {}
            if (!next) window.speechSynthesis?.cancel();
          }}
        >
          Sound {sound ? 'on' : 'off'}
        </button>
        <div className="hero-actions">
          <button onClick={onBuild} className="hero-primary">
            Build your XI <ArrowUpRight size={18} />
          </button>
          <button onClick={onLeaderboard} className="hero-secondary">
            <Trophy size={16} /> Leaderboard
          </button>
        </div>
        {match && (
          <div className="hero-match">
            <strong>
              {match.status === 'COMPLETED'
                ? 'FINAL COMPLETE'
                : match.team_selection_disabled ? 'PROVISIONAL FINAL · AWAITING QUALIFICATION'
                : match.is_locked
                  ? 'FINAL LINEUPS LOCKED'
                  : 'GRAND FINAL · SQUAD SELECTION OPEN'}
            </strong>
            <p>{match.title || 'Pakistan A vs Sri Lanka A'}</p>
            <small>
              {new Date(match.match_date).toLocaleString("en-PK", {timeZone:"Asia/Karachi",dateStyle:"medium",timeStyle:"short"})} PKT • {match.venue}
            </small>
          </div>
        )}
        <p className="hero-proof">
          <ShieldCheck size={14} /> 50-Over Format • 3X Power Booster • Real-Time Leaderboard
        </p>
      </div>

      <div className="rivalry-panel" aria-label="Final match information">
        <div className="rivalry-team pakistan-a">
          <span className="team-kicker">SHAHEENS</span>
          <strong className="text-emerald-400">PAK</strong>
          <span>Pakistan A</span>
          <small>Crescent Green &amp; Gold</small>
        </div>
        <div className="rivalry-divider"><span>V</span></div>
        <div className="rivalry-team sri-lanka-a">
          <span className="team-kicker">ISLAND STARS</span>
          <strong className="text-blue-400">SL</strong>
          <span>Sri Lanka A</span>
          <small>Royal Blue &amp; Gold</small>
        </div>
        <div className="rivalry-footer">
          <span>SUN, 29 NOV 2026</span>
          <span>50-OVER GRAND FINAL</span>
        </div>
      </div>
    </section>
  );
}
