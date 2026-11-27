import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

// Active competition offers exactly ONE power booster: 3X Booster
export const powers = [
  { role: '3X', name: '3X Booster', icon: '🌟', description: '3× points for one chosen non-C/VC player in your XI' }
];

const historicalPowers = [
  { role: '3X', name: '3X Booster', icon: '🌟', description: '3× points for one chosen non-C/VC player in your XI' },
  { role: 'BAT', name: 'Power Batsman', icon: '🏏', description: '2× every batter in your XI' },
  { role: 'BOWL', name: 'Power Bowler', icon: '🎯', description: '2× every bowler in your XI' },
  { role: 'AR', name: 'Power All-Rounder', icon: '⚡', description: '2× every all-rounder in your XI' },
  { role: 'WK', name: 'Power Wicketkeeper', icon: '🧤', description: '2× every wicketkeeper in your XI' },
];

export default function PowerBoosters({ matchId, userId, scope, locked, choice, onChoose, saved, onDismiss, onStatus, busy }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reload, setReload] = useState(0);
  const [tripleTarget, setTripleTarget] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const dialog = useRef(null);
  const mounted = useRef(true);
  const inflight = useRef(false);
  const cancelInflight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError('');
    setCancelConfirm(false);
    if (userId && matchId) {
      api.get(`/power-boosters?match_id=${matchId}`).then(({ data }) => {
        if (cancelled) return;
        setStatus(data);
        onStatus({ ...data, scope });
      }).catch(() => {
        if (!cancelled) setError('Could not load booster inventory. Retry before selecting a power.');
      });
    }
    return () => { cancelled = true; };
  }, [matchId, userId, reload, locked]);

  useEffect(() => {
    if (!saved) return;
    setTripleTarget(saved.players?.some(p => p.id === saved.preferredPlayerId && p.id !== saved.captainId && p.id !== saved.viceCaptainId) ? String(saved.preferredPlayerId) : '');
    const previous = document.activeElement;
    dialog.current?.querySelector('button,select')?.focus();
    return () => previous?.focus?.();
  }, [saved]);

  const selected = historicalPowers.find(p => p.role === saved?.role) || powers[0];
  const active = historicalPowers.find(p => p.role === status?.active_role);
  const canCancel = Boolean(active && !locked && status?.can_cancel === true);
  const candidates = (saved?.players || []).filter(p => p.id !== saved?.captainId && p.id !== saved?.viceCaptainId);

  function sync(data) {
    setStatus(data);
    onStatus({ ...data, scope });
    setError('');
    setUncertain(false);
    window.dispatchEvent(new Event('fantasy-team-saved'));
  }

  function accepted(data) {
    sync(data);
    onChoose(null);
    onDismiss();
  }

  async function apply() {
    if (inflight.current || !saved || (saved.role === '3X' && !Number(tripleTarget))) return;
    inflight.current = true;
    setApplying(true);
    setError('');
    try {
      const payload = { match_id: matchId, team_id: saved.teamId, lineup_revision: saved.revision, role: saved.role };
      if (saved.role === '3X') payload.player_id = Number(tripleTarget);
      const { data } = await api.post('/power-boosters/apply', payload);
      if (mounted.current) accepted(data);
    } catch (e) {
      if (!mounted.current) return;
      try {
        const { data } = await api.get(`/power-boosters?match_id=${matchId}`);
        if (!mounted.current) return;
        if (data.active_role === saved.role && (saved.role !== '3X' || data.active_player_id === Number(tripleTarget))) {
          accepted(data);
          return;
        }
        setStatus(data);
        setUncertain(false);
        setError(e.response?.data?.detail || 'Booster not confirmed. Retry or save your team without a booster.');
      } catch {
        if (mounted.current) {
          setUncertain(true);
          setError('Could not verify confirmation. Retry safely to check whether this booster was reserved.');
        }
      }
    } finally {
      inflight.current = false;
      if (mounted.current) setApplying(false);
    }
  }

  async function cancelActive() {
    if (cancelInflight.current || !canCancel) return;
    cancelInflight.current = true;
    setCanceling(true);
    setError('');
    try {
      const { data } = await api.post('/power-boosters/cancel', {
        match_id: matchId,
        reservation_id: status.uses.find(u => u.match_id === matchId)?.reservation_id
      });
      if (!mounted.current) return;
      sync(data);
      setCancelConfirm(false);
      onChoose(null);
    } catch (e) {
      if (!mounted.current) return;
      try {
        const { data } = await api.get(`/power-boosters?match_id=${matchId}`);
        if (!mounted.current) return;
        sync(data);
        if (!data.active_role) {
          setCancelConfirm(false);
          onChoose(null);
          return;
        }
        setError(e.response?.data?.detail || 'Booster cancellation was not confirmed. Please retry.');
      } catch {
        if (mounted.current) setError('Could not verify cancellation. Retry inventory before changing your booster.');
      }
    } finally {
      cancelInflight.current = false;
      if (mounted.current) setCanceling(false);
    }
  }

  function close() {
    if (applying) return;
    if (uncertain) {
      setStatus(null);
      setReload(n => n + 1);
    }
    onChoose(null);
    onDismiss();
  }

  function trap(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!uncertain) close();
    }
    if (e.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled),select:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <section aria-label="Tournament power booster" className="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-slate-950 via-[#101827] to-slate-950 p-4 sm:p-5 shadow-xl">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="text-lg font-black text-amber-300">🌟 3X Power Booster</h2>
        <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30">1 active booster · once for final</span>
      </div>
      <p className="text-xs text-slate-300 mt-2">
        Optionally boost one player to earn <strong>3X fantasy points</strong>. Captain (2×) and Vice-Captain (1.5×) are mandatory; the 3X player must be distinct from both. You can cancel or switch before match lock.
      </p>

      {status && (
        <div className="mt-3 text-xs text-slate-300" aria-live="polite">
          <strong className="text-amber-300">{status.uses.filter(u => u.consumed).length} of 1 Booster Used</strong> · {status.uses.filter(u => !u.consumed).length} reserved · {Math.max(0, 1 - status.uses.length)} available
        </div>
      )}

      {!userId && <p className="text-xs text-amber-200 mt-3">Sign in to reserve the 3X booster.</p>}

      {active && (
        <div role="status" className="mt-3 rounded-xl border border-amber-400 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-black">
            {active.icon} {active.name} {canCancel ? 'reserved for this match' : `CONSUMED — locked for match ${matchId}`}
            {active.role === '3X' && status.active_player_id ? ` · Player #${status.active_player_id}` : ''}
          </p>
          {canCancel ? (
            <div className="mt-2">
              <p className="text-xs text-slate-200">You can cancel only while this match is open. Your saved XI stays unchanged.</p>
              {!cancelConfirm ? (
                <button
                  type="button"
                  disabled={canceling || applying}
                  onClick={() => setCancelConfirm(true)}
                  className="mt-3 rounded-lg border border-rose-400 px-3 py-2 font-bold text-rose-200 disabled:opacity-40 hover:bg-rose-500/20"
                >
                  Cancel this booster
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-rose-500/50 bg-black/30 p-3">
                  <p className="text-xs font-semibold mb-2">Release {active.name}? Your lineup stays saved and the booster becomes available again.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={canceling}
                      onClick={cancelActive}
                      className="rounded-lg bg-rose-500 px-3 py-2 text-white font-black disabled:opacity-40"
                    >
                      {canceling ? 'Canceling…' : 'Yes, release booster'}
                    </button>
                    <button
                      type="button"
                      disabled={canceling}
                      onClick={() => setCancelConfirm(false)}
                      className="rounded-lg border border-slate-500 px-3 py-2 font-bold text-slate-200"
                    >
                      Keep booster
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-200 mt-2">This booster is locked and applied to your score. It cannot be canceled while selection is locked.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 mt-4">
        {powers.map(p => {
          const used = status?.uses?.find(u => u.role === p.role);
          const disabled = !userId || !status || locked || busy || applying || canceling || Boolean(active) || Boolean(used);
          const isChosen = choice === p.role || active?.role === p.role;
          return (
            <button
              type="button"
              key={p.role}
              disabled={disabled}
              aria-pressed={isChosen}
              onClick={() => onChoose(choice === p.role ? null : p.role)}
              className={`rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed ${
                isChosen ? 'border-amber-300 bg-amber-400/20 shadow-lg shadow-amber-400/10' : 'border-slate-700 bg-black/20 hover:border-amber-400/50'
              } ${used && active?.role !== p.role ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xl" aria-hidden="true">{p.icon}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-300">
                  {!status ? 'CHECKING' : used ? (used.consumed ? 'CONSUMED' : 'RESERVED') : 'AVAILABLE'}
                </span>
              </div>
              <span className="block text-base font-black text-white">{p.name} (3X Points)</span>
              <span className="block text-xs text-slate-300 mt-1">
                {used
                  ? (used.consumed ? 'CONSUMED — locked for this final' : 'RESERVED for this final')
                  : (choice === p.role ? 'Selected · confirm player after saving XI' : p.description)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {locked
          ? 'MATCH LOCKED — lineups and booster changes are blocked.'
          : choice
            ? 'Save your XI first, then confirm your 3X player in the popup.'
            : 'You may save your team with or without activating the 3X booster.'}
      </p>

      {error && !saved && (
        <div role="alert" className="mt-3 text-xs text-rose-200">
          {error} <button type="button" onClick={() => setReload(n => n + 1)} className="underline font-bold">Retry inventory</button>
        </div>
      )}

      {saved && selected && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onKeyDown={trap}>
          <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="power-confirm-title" aria-describedby="power-confirm-description" className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-400 bg-[#101827] p-6 shadow-2xl">
            <div className="text-4xl mb-3" aria-hidden="true">{selected.icon}</div>
            <p className="text-xs uppercase font-bold tracking-widest text-emerald-400">Lineup saved successfully</p>
            <h2 id="power-confirm-title" className="text-2xl font-black text-amber-300 mt-2">Activate {selected.name}?</h2>
            <p id="power-confirm-description" className="text-sm text-slate-200 mt-3">
              {selected.description}. The 3X booster triples your chosen player&apos;s base fantasy points.
            </p>

            <label className="block mt-4 text-sm font-bold text-amber-200">
              Choose the player to triple:
              <select
                aria-label="3X target player"
                value={tripleTarget}
                onChange={e => setTripleTarget(e.target.value)}
                className="block w-full rounded-lg bg-slate-950 border border-amber-500 p-3 mt-2 text-white font-medium"
              >
                <option value="">Select one saved player (non-C, non-VC)</option>
                {candidates.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.team} · {p.role}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-normal text-slate-400 mt-2">
                Captain and Vice-Captain cannot receive the 3X booster.
              </span>
            </label>

            <p className="text-xs text-amber-200/90 mt-3">
              You can cancel or switch while selection is open. A locked booster cannot be changed unless the administrator reopens selection.
            </p>

            {error && <p role="alert" className="text-sm text-rose-300 mt-3">{error}</p>}

            <div className="grid gap-2 mt-5">
              <button
                type="button"
                disabled={applying || locked || !tripleTarget}
                onClick={apply}
                className="rounded-xl bg-amber-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50 hover:bg-amber-300 transition-colors"
              >
                {applying ? 'Confirming…' : (uncertain ? 'Retry confirmation' : 'CONFIRM 3X BOOSTER')}
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={close}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-slate-800 transition-colors"
              >
                {uncertain ? 'Close — verify status before continuing' : 'SAVE TEAM WITHOUT BOOSTER'}
              </button>
            </div>
            {locked && <p className="text-xs text-amber-200 mt-2">The deadline has passed. Your saved XI still counts.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
