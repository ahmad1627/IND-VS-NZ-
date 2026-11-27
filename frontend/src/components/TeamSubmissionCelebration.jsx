import React from 'react';
import { CheckCircle2, Crown, Volume2, X } from 'lucide-react';

const confettiPieces = Array.from({ length: 22 }, (_, index) => index);

const TeamSubmissionCelebration = ({ details, onClose, onReplayVoice }) => {
  if (!details) return null;

  return (
    <div
      className="fantasy-celebration-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fantasy-submission-heading"
    >
      <div className="fantasy-confetti-layer pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <span
            key={piece}
            className="fantasy-confetti-piece"
            style={{
              left: `${(piece * 37) % 100}%`,
              animationDelay: `${(piece % 8) * -0.22}s`,
              animationDuration: `${2.8 + (piece % 5) * 0.35}s`,
              '--confetti-hue': `${38 + ((piece * 29) % 115)}`,
            }}
          />
        ))}
      </div>

      <section className="fantasy-celebration-card relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-amber-300/70 bg-[#101827] shadow-[0_25px_100px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close submission confirmation"
          className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/30 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-950 to-[#101827] px-5 pb-5 pt-8 text-center sm:px-8">
          <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-slate-300/10 blur-3xl" />
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-300 text-slate-950 shadow-[0_0_35px_rgba(251,191,36,0.32)]">
            <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
          </div>
          <p className="relative text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Submission confirmed</p>
          <h2 id="fantasy-submission-heading" className="relative mt-2 text-2xl font-black text-white sm:text-3xl">
            Congratulations, {details.managerName}!
          </h2>
          <p className="relative mt-2 text-sm font-semibold text-slate-100">
            Your fantasy team has been successfully submitted.
          </p>
          <div className="relative mx-auto mt-4 max-w-md rounded-2xl border border-amber-300/45 bg-black/20 px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
              <Crown className="h-3.5 w-3.5" /> Fantasy manager team
            </div>
            <div className="mt-1 break-words text-xl font-black text-white">{details.fantasyTeamName}</div>
            {details.matchTitle && <div className="mt-1 text-[11px] font-semibold text-slate-200">{details.matchTitle}</div>}
          </div>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Your selected XI</h3>
              <p className="mt-0.5 text-[10px] text-slate-300">{details.players.length} players • saved to your fantasy entry</p>
            </div>
            <span className="rounded-full border border-slate-500/50 bg-slate-500/10 px-2.5 py-1 text-[10px] font-black text-slate-200">SAVED ✓</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {details.players.map((player, index) => (
              <div key={player.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-800/80 bg-[#101827] px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-amber-300">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold text-white">{player.name}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-300">{player.team} • {player.role}</div>
                </div>
                {player.designation && (
                  <span className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-1 text-[8px] font-black text-amber-200">{player.designation}</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={onReplayVoice}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-xs font-bold text-slate-100 transition hover:bg-slate-800"
            >
              <Volume2 className="h-4 w-4 text-amber-300" /> Hear confirmation again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-400/15 transition hover:brightness-105 active:scale-[0.98]"
            >
              Continue to fantasy game
            </button>
          </div>
          <p className="mt-3 text-center text-[9px] text-slate-500">This confirmation closes automatically after a few seconds.</p>
        </div>
      </section>
    </div>
  );
};

export default TeamSubmissionCelebration;
