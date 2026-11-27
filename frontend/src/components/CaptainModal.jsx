import React from 'react';
import { X, Check, Award, Sparkles, Shield } from 'lucide-react';
import { teamColors } from '../utils/teamColors';

const CaptainModal = ({
  isOpen,
  onClose,
  selectedPlayers,
  captainId,
  viceCaptainId,
  boosterId,
  onSelectCaptain,
  onSelectViceCaptain,
  onSelectBooster,
  onConfirmSave,
  isSubmitting
}) => {
  if (!isOpen) return null;

  const valid = Boolean(captainId && viceCaptainId && captainId !== viceCaptainId);

  const handleCaptainClick = (playerId) => {
    onSelectCaptain(playerId);
    if (viceCaptainId === playerId) onSelectViceCaptain(null);
    if (boosterId === playerId && onSelectBooster) onSelectBooster(null);
  };

  const handleViceCaptainClick = (playerId) => {
    onSelectViceCaptain(playerId);
    if (captainId === playerId) onSelectCaptain(null);
    if (boosterId === playerId && onSelectBooster) onSelectBooster(null);
  };

  const handleBoosterClick = (playerId) => {
    if (!onSelectBooster) return;
    if (boosterId === playerId) {
      onSelectBooster(null); // toggle off
    } else {
      if (captainId === playerId) onSelectCaptain(null);
      if (viceCaptainId === playerId) onSelectViceCaptain(null);
      onSelectBooster(playerId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#101827] border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Leadership & 3X Booster Selection
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Select mandatory <strong>Captain (2×)</strong> & <strong>Vice-Captain (1.5×)</strong>, and optional <strong>3X Booster (3×)</strong>. All three must be distinct players.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Player List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {selectedPlayers.map(player => {
            const isC = player.id === captainId;
            const isVC = player.id === viceCaptainId;
            const is3X = player.id === boosterId;

            return (
              <div
                key={player.id}
                className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                  isC
                    ? 'border-amber-400/80 bg-amber-400/10'
                    : isVC
                      ? 'border-indigo-400/80 bg-indigo-400/10'
                      : is3X
                        ? 'border-fuchsia-400/80 bg-fuchsia-500/10'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${teamColors(player.team)}`}>
                    {player.role}
                  </div>
                  <div>
                    <strong className="text-sm text-white flex items-center gap-1.5">
                      {player.name}
                      {player.is_captain && (
                        <span className="text-[10px] text-amber-400 font-normal">(Team Captain)</span>
                      )}
                    </strong>
                    <div className="text-[11px] text-slate-400">
                      {player.team === 'PAK' ? 'Pakistan A' : player.team === 'SL' ? 'Sri Lanka A' : player.team} • {player.role}
                    </div>
                  </div>
                </div>

                {/* Selection Controls: C, VC, 3X */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Captain Button */}
                  <button
                    type="button"
                    onClick={() => handleCaptainClick(player.id)}
                    aria-label={`Select ${player.name} as Captain`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                      isC
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/20'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-amber-400/60 hover:text-amber-300'
                    }`}
                  >
                    {isC ? '✓ C (2X)' : 'C (2X)'}
                  </button>

                  {/* Vice-Captain Button */}
                  <button
                    type="button"
                    onClick={() => handleViceCaptainClick(player.id)}
                    aria-label={`Select ${player.name} as Vice-Captain`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                      isVC
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-indigo-400/60 hover:text-indigo-300'
                    }`}
                  >
                    {isVC ? '✓ VC (1.5X)' : 'VC (1.5X)'}
                  </button>

                  {/* 3X Booster Button */}
                  {onSelectBooster && (
                    <button
                      type="button"
                      onClick={() => handleBoosterClick(player.id)}
                      aria-label={`Select ${player.name} for 3X Booster`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                        is3X
                          ? 'bg-fuchsia-500 text-white border-fuchsia-300 shadow-md shadow-fuchsia-500/20'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-fuchsia-400/60 hover:text-fuchsia-300'
                      }`}
                    >
                      {is3X ? '✓ 3X (3X)' : '3X'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <p className={`text-xs font-bold ${valid ? 'text-emerald-400' : 'text-amber-300'}`}>
            {valid ? (
              <>
                <Check className="inline w-4 h-4 mr-1 text-emerald-400" />
                Lineup leadership ready{boosterId ? ' with 3X Booster chosen' : ''}.
              </>
            ) : (
              'Select a Captain (2X) and a different Vice-Captain (1.5X).'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-300 hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmSave}
              disabled={!valid || isSubmitting}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase bg-amber-400 text-slate-950 disabled:opacity-40 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
            >
              {isSubmitting ? 'Saving…' : 'Save Lineup'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CaptainModal;
