import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
const EngagementHub = lazy(() => import('./components/EngagementHub'));
import SmartValidator from './components/SmartValidator';
import './components/engagement.css';
import PowerBoosters from './components/PowerBoosters';
import SeriesHero from './components/SeriesHero';
import './series.css';
import Navbar from './components/Navbar';
const AdminToolbar = lazy(() => import('./components/AdminToolbar'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
import LiveScores from './components/LiveScores';
import LiveMyPoints from './components/LiveMyPoints';
import FixtureCarousel from './components/FixtureCarousel';
import TeamBuilder from './components/TeamBuilder';
const AiFantasyAssistant = lazy(() => import('./components/AiFantasyAssistant'));
import PitchPreview from './components/PitchPreview';
import TeamSubmissionCelebration from './components/TeamSubmissionCelebration';
import CaptainModal from './components/CaptainModal';
import Leaderboard from './components/Leaderboard';
import UserTeamPitchModal from './components/UserTeamPitchModal';
import OdiSeriesStandings from './components/OdiSeriesStandings';
import AuthModal from './components/AuthModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import OnboardingModal from './components/OnboardingModal';
import ProfileModal from './components/ProfileModal';
import RulesModal from './components/RulesModal';
import MobileDrawer from './components/MobileDrawer';
import MobileBottomNav from './components/MobileBottomNav';
import { useAuth } from './context/AuthContext';
import { Clock, Shield, CheckCircle2 } from 'lucide-react';
import api from './api';
import { playFantasySound, speakFantasySubmission } from './utils/fantasyAudio';

// Dynamic Live Countdown Banner for the currently active fixture
const MatchCountdownBanner = ({ match }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!match?.match_date) return;

    const calculate = () => {
      const target = new Date(match.match_date).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [match?.match_date]);

  if (!match) return null;

  const isLocked = match.is_locked;
  const isCompleted = match.status === 'COMPLETED';

  const formatMatchDateHeader = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase();
    } catch {
      return 'NOV 2026';
    }
  };

  return (
    <div className="match-countdown-banner mb-5 bg-linear-to-r from-slate-950 via-[#101827] to-slate-950 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden gold-glow">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center md:text-left">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md flex-shrink-0">
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            ) : isLocked ? (
              <Shield className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Clock className="w-6 h-6 stroke-[2.5]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isCompleted
                  ? 'bg-slate-900 text-slate-200 border border-slate-500'
                  : isLocked
                  ? 'bg-amber-950 text-amber-300 border border-amber-500'
                  : 'bg-amber-400 text-slate-950'
              }`}>
                {isCompleted
                  ? `FINAL • COMPLETED`
                  : match.team_selection_disabled
                  ? "FINAL • QUALIFICATION PENDING"
                  : isLocked
                  ? "FINAL • LINEUPS LOCKED"
                  : match.selection_override === 'OPEN' ? 'FINAL • ADMIN REOPENED SELECTION'
                  : `FINAL • STARTS ${formatMatchDateHeader(match.match_date)} • ${new Date(match.match_date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`}
              </span>
              <span className="text-[10px] text-slate-300 font-bold hidden sm:inline">
                {match.venue}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1">
              {match.title}
            </h2>
            <p className="text-xs text-slate-300">
              {isCompleted
                ? `Match finished. ${match.scorecard_summary || `Won by ${match.winner_team}`}. Check Leaderboard for points breakdown!`
                : match.team_selection_disabled
                ? 'Provisional fixture — team selection opens after the administrator verifies qualification.'
                : isLocked
                ? 'The lineup deadline has passed or the administrator locked this match. Points update after score entry.'
                : 'Pick 11 eligible players, Captain (2X) and Vice-Captain (1.5X). One optional 3X booster is available.'}
            </p>
          </div>
        </div>

        {/* Live Countdown Display or Match Status Pill */}
        {isCompleted ? (
          <div className="bg-slate-950/80 border border-slate-500 rounded-xl px-4 py-2.5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Match Status</span>
            <div className="text-sm font-black text-amber-400">Finished & Archived</div>
          </div>
        ) : isLocked ? (
          <div className="bg-amber-950/90 border border-amber-500 rounded-xl px-4 py-2.5 text-center shadow-inner">
            <span className="text-[10px] font-bold text-amber-300 uppercase flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Awaiting score updates
            </span>
            <div className="text-xs font-black text-white mt-0.5">Lineups Strictly Frozen</div>
          </div>
        ) : match.selection_override === 'OPEN' ? (
          <div className="bg-emerald-950 border border-emerald-500 rounded-xl p-3 text-center text-xs font-bold text-emerald-200">Selection reopened · Admin will lock again</div>
        ) : (
          <div className="flex items-center gap-2 bg-black/50 border border-slate-700/80 rounded-xl px-4 py-2 shadow-inner">
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{String(timeLeft.days).padStart(2, '0')}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Days</span>
            </div>
            <span className="text-amber-400 font-bold text-lg mb-2">:</span>
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Hours</span>
            </div>
            <span className="text-amber-400 font-bold text-lg mb-2">:</span>
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Mins</span>
            </div>
            <span className="text-amber-400 font-bold text-lg mb-2">:</span>
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{String(timeLeft.seconds).padStart(2, '0')}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Secs</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const { user, token, sessionError } = useAuth();

  // Navigation & View States
  const [powerChoice, setPowerChoice] = useState(null);
  const [powerPrompt, setPowerPrompt] = useState(null);
  const [powerStatus, setPowerStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'leaderboard' | 'standings'
  
  // Tournament & Match Data
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Players & Squads for current match
  const [categorizedPlayers, setCategorizedPlayers] = useState({ WK: [], BAT: [], AR: [], BOWL: [] });
  const [allPlayers, setAllPlayers] = useState([]);

  // User Lineup Selection
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [captainId, setCaptainId] = useState(null);
  const [viceCaptainId, setViceCaptainId] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [submissionCelebration, setSubmissionCelebration] = useState(null);
  const [savedSignature, setSavedSignature] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [matchesError, setMatchesError] = useState('');
  const squadSignature = JSON.stringify([selectedMatch?.id,selectedPlayers.map(p=>p.id),captainId,viceCaptainId]);
  const isSquadSaved = savedSignature === squadSignature;

  // Keep the successful-submission celebration visible briefly, then dismiss it.
  useEffect(() => {
    if (!submissionCelebration) return undefined;
    const timeoutId = window.setTimeout(() => setSubmissionCelebration(null), 9500);
    return () => window.clearTimeout(timeoutId);
  }, [submissionCelebration]);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isCaptainModalOpen, setIsCaptainModalOpen] = useState(false);
  const [isMobilePitchOpen, setIsMobilePitchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const scope = `${user?.id || 'guest'}:${selectedMatch?.id || ''}`;
  const boosterId = powerStatus?.scope === scope && powerStatus.active_role === '3X' ? powerStatus.active_player_id : null;
  const draftTripleId = powerChoice?.scope === scope ? powerChoice.playerId || null : null;
  const pendingGuestDraft = useRef(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [loadedScope, setLoadedScope] = useState(null);
  const [reloadTeam, setReloadTeam] = useState(0);
  const draftKey = (matchId, owner) => `fantasy_acc_final_2026_draft_m${matchId}_u${owner || 'guest'}`;

  useEffect(() => {
    if (!selectedMatch || loadedScope !== scope) return;
    try {
      localStorage.setItem(draftKey(selectedMatch.id, user?.id), JSON.stringify({
        match_id: selectedMatch.id,
        player_ids: selectedPlayers.map(p => p.id),
        captain_id: captainId, vice_captain_id: viceCaptainId
      }));
    } catch {}
  }, [scope, loadedScope, selectedPlayers, captainId, viceCaptainId]);

  const isCurrentMatchLocked = Boolean(
    selectedMatch?.team_selection_disabled ||
    selectedMatch?.is_locked ||
    selectedMatch?.status === 'COMPLETED'
  );

  useEffect(() => {
    if (isCurrentMatchLocked) { setIsCaptainModalOpen(false); setPowerPrompt(null); setPowerChoice(null); }
  }, [isCurrentMatchLocked]);

  // Inspect User Team Pitch Modal (from Leaderboard)
  const [inspectedTeamId, setInspectedTeamId] = useState(null);
  const [inspectedTeamDetails, setInspectedTeamDetails] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Load Matches on boot
  const loadMatches = async () => {
    try {
      const res = await api.get('/matches');
      setMatchesError('');
      setMatches(res.data);

      const actRes = {data:res.data.find(m => m.status !== 'COMPLETED') || res.data[res.data.length-1]};
      setActiveMatch(actRes.data);
      if (!selectedMatch) {
        setSelectedMatch(actRes.data);
      } else {
        const updated = res.data.find((m) => m.id === selectedMatch.id);
        if (updated) setSelectedMatch(prev=>prev?.id !== updated.id || JSON.stringify(prev)===JSON.stringify(updated)?prev:updated);
      }
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return;
      const msg = err.response?.data?.detail || (err.code === 'ERR_NETWORK' || !err.response ? 'Could not reach the game server. Check your connection and retry.' : 'Could not load the game. Check your connection and retry.'); setMatchesError(msg);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    const timer=setInterval(()=>{if(!document.hidden)loadMatches();},15000);
    const visible=()=>{if(!document.hidden)loadMatches();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  }, [selectedMatch?.id]);

  useEffect(() => {
    const refreshPlayerPool = () => setReloadTeam(current => current + 1);
    window.addEventListener('fantasy-squad-updated', refreshPlayerPool);
    return () => window.removeEventListener('fantasy-squad-updated', refreshPlayerPool);
  }, []);

  // Server data confirms a saved team. Browser drafts never count as submitted.
  useEffect(() => {
    if (!selectedMatch) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoadedScope(null);
    setLoadError('');
    setSavedSignature(null);
    setSelectedPlayers([]); setCaptainId(null); setViceCaptainId(null);
    setCategorizedPlayers({ WK: [], BAT: [], AR: [], BOWL: [] });
    setAllPlayers([]);
    const load = async () => {
      try {
        const [playersRes, teamRes] = await Promise.all([
          api.get(`/matches/${selectedMatch.id}/players`, { signal: controller.signal }),
          user ? api.get(`/teams/my-team?match_id=${selectedMatch.id}`, { signal: controller.signal }) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        const players = playersRes.data.all_players;
        setCategorizedPlayers(playersRes.data.categorized_players);
        setAllPlayers(players);
        const team = teamRes?.data.has_team ? teamRes.data.team : null;
        let draft = null;
        try { draft = JSON.parse(localStorage.getItem(draftKey(selectedMatch.id,user?.id)) || 'null'); } catch {}
        if (user && pendingGuestDraft.current?.match_id === selectedMatch.id) {
          if (!draft) draft = pendingGuestDraft.current;
          pendingGuestDraft.current = null;
        }
        if (team) {
          const squad = team.players.map(p => players.find(ap => ap.id === p.id) || p);
          setSelectedPlayers(squad); setCaptainId(team.captain_id); setViceCaptainId(team.vice_captain_id);
          setSavedSignature(JSON.stringify([selectedMatch.id,squad.map(p => p.id),team.captain_id,team.vice_captain_id]));
        } else if (draft?.match_id === selectedMatch.id && Array.isArray(draft.player_ids)) {
          setSelectedPlayers(draft.player_ids.map(id => players.find(p => p.id === id)).filter(Boolean));
          setCaptainId(draft.captain_id); setViceCaptainId(draft.vice_captain_id);
        }
        setLoadedScope(scope);
      } catch {
        if (!cancelled) setLoadError('Could not load your saved team. Editing is paused to protect it. Please retry.');
      }
    };
    load();
    return () => { cancelled = true; controller.abort(); };
  }, [scope, reloadTeam]);

  useEffect(() => { setPowerChoice(null); setPowerPrompt(null); setPowerStatus(null); }, [scope]);

  // Validate Team Selection in real-time
  useEffect(() => {
    if (!selectedMatch) return;
    const errors = [];
    const teamA = selectedMatch.team_a;
    const teamB = selectedMatch.team_b;

    // Total Players
    if (selectedPlayers.length < 11) {
      errors.push(`Select exactly 11 players (${11 - selectedPlayers.length} remaining).`);
    } else if (selectedPlayers.length > 11) {
      errors.push(`Only 11 players allowed (currently ${selectedPlayers.length}).`);
    }

    // Role Counts
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    const teamCounts = { [teamA]: 0, [teamB]: 0 };

    selectedPlayers.forEach((p) => {
      counts[p.role] = (counts[p.role] || 0) + 1;
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    });

    if (counts.WK < 1) errors.push('Minimum 1 Wicketkeeper (WK) required.');
    if (counts.WK > 4) errors.push('Maximum 4 Wicketkeepers (WK) allowed.');

    if (counts.BAT < 3) errors.push('Minimum 3 Batters (BAT) required.');
    if (counts.BAT > 6) errors.push('Maximum 6 Batters (BAT) allowed.');

    if (counts.AR < 1) errors.push('Minimum 1 All-Rounder (AR) required.');
    if (counts.AR > 4) errors.push('Maximum 4 All-Rounders (AR) allowed.');

    if (counts.BOWL < 3) errors.push('Minimum 3 Bowlers (BOWL) required.');
    if (counts.BOWL > 6) errors.push('Maximum 6 Bowlers (BOWL) allowed.');

    // Team balance
    if (selectedPlayers.length > 0) {
      if (teamCounts[teamA] > 7) errors.push(`Maximum 7 players allowed from ${teamA}.`);
      if (teamCounts[teamB] > 7) errors.push(`Maximum 7 players allowed from ${teamB}.`);
      if (selectedPlayers.length === 11) {
        if (teamCounts[teamA] < 1) errors.push(`At least 1 player required from ${teamA}.`);
        if (teamCounts[teamB] < 1) errors.push(`At least 1 player required from ${teamB}.`);
      }
    }

    // Captain / Vice-Captain
    if (selectedPlayers.length === 11) {
      if (!captainId) errors.push('Assign a Captain (2.0x points).');
      if (!viceCaptainId) errors.push('Assign a Vice-Captain (1.5x points).');
      if (captainId && viceCaptainId && captainId === viceCaptainId) errors.push('Captain and Vice-Captain must be different players.');
      if (boosterId && ([captainId,viceCaptainId].includes(boosterId) || !selectedPlayers.some(p=>p.id===boosterId))) errors.push('Cancel the reserved 3X booster before changing its player or assigning them C/VC.');
    }

    setValidationErrors(errors);
  }, [selectedPlayers, captainId, viceCaptainId, boosterId, selectedMatch]);

  // Toggle player selection
  const handleTogglePlayer = (player) => {
    if (loadedScope !== scope || isSubmitting || loadError) return;
    if (isCurrentMatchLocked) {
      alert('Lineup selections are strictly locked for this match (deadline / admin lock).');
      return;
    }

    const exists = selectedPlayers.some((p) => p.id === player.id);
    if (!exists && player.availability_status === 'OUT') {
      alert(`${player.name} is marked unavailable and cannot be selected for this match.`);
      return;
    }
    if (exists) {
      // Remove with a short UI sound.
      playFantasySound('remove');
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id));
      if (draftTripleId === player.id) setPowerChoice(null);
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
      } else {
      // Check limits before adding
      if (selectedPlayers.length >= 11) {
        alert('You have already selected 11 players. Remove a player first to add another.');
        return;
      }

      const teamCount = selectedPlayers.filter((p) => p.team === player.team).length;
      if (teamCount >= 7) {
        alert(`Maximum 7 players allowed from ${player.team}.`);
        return;
      }

      const roleCount = selectedPlayers.filter((p) => p.role === player.role).length;
      const maxLimits = { WK: 4, BAT: 6, AR: 4, BOWL: 6 };
      if (roleCount >= maxLimits[player.role]) {
        alert(`Maximum ${maxLimits[player.role]} ${player.role}s allowed.`);
        return;
      }

      // Add with a short UI sound.
      playFantasySound('add');
      const updated = [...selectedPlayers, player];
      setSelectedPlayers(updated);

      // Auto-assign Captain & Vice-Captain for convenience if empty
      if (!captainId) {
        setCaptainId(player.id);
      } else if (!viceCaptainId && player.id !== captainId) {
        setViceCaptainId(player.id);
      }
    }
  };

  const handleRemovePlayer = (playerId) => {
    if (loadedScope !== scope || isSubmitting || isCurrentMatchLocked || loadError) return;
    if (!selectedPlayers.some((player) => player.id === playerId)) return;
    playFantasySound('remove');
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));
    if (draftTripleId === playerId) setPowerChoice(null);
    if (captainId === playerId) setCaptainId(null);
    if (viceCaptainId === playerId) setViceCaptainId(null);
  };

  const handleSetCaptain = (playerId) => {
    if (loadedScope !== scope || isSubmitting || isCurrentMatchLocked || loadError) return;
    if (viceCaptainId === playerId) setViceCaptainId(null);
    if (draftTripleId === playerId) setPowerChoice(null);
    setCaptainId(playerId);
  };

  const handleSetViceCaptain = (playerId) => {
    if (loadedScope !== scope || isSubmitting || isCurrentMatchLocked || loadError) return;
    if (captainId === playerId) setCaptainId(null);
    if (draftTripleId === playerId) setPowerChoice(null);
    setViceCaptainId(playerId);
  };

  // Recommendations only modify an editable draft, never reserve or submit.
  const applyAiDraft = (ids, leadership) => {
    if (loadedScope !== scope || isSubmitting || isCurrentMatchLocked || loadError || !selectedMatch?.is_active) return;
    if (!Array.isArray(ids) || ids.length !== 11 || new Set(ids).size !== 11 || !leadership) return;
    const pool = new Map(allPlayers.filter(p => p.active !== false && p.availability_status !== 'OUT' && p.match_eligibility?.includes(selectedMatch.id)).map(p=>[p.id,p]));
    const chosen=ids.map(id=>pool.get(id));
    if (chosen.some(p=>!p)) return;
    const limits={WK:[1,4],BAT:[3,6],AR:[1,4],BOWL:[3,6]};
    if (Object.entries(limits).some(([r,[min,max]])=>{const n=chosen.filter(p=>p.role===r).length;return n<min||n>max;})) return;
    if ([selectedMatch.team_a,selectedMatch.team_b].some(t=>{const n=chosen.filter(p=>p.team===t).length;return n<1||n>7;})) return;
    const {captain_id,vice_captain_id,booster_id}=leadership;
    if (new Set([captain_id,vice_captain_id,booster_id]).size!==3 || ![captain_id,vice_captain_id,booster_id].every(id=>ids.includes(id))) return;
    if (boosterId && (booster_id!==boosterId || captain_id===boosterId || vice_captain_id===boosterId || JSON.stringify([...ids].sort())!==JSON.stringify(selectedPlayers.map(p=>p.id).sort()))) return;
    setSelectedPlayers(chosen);setCaptainId(captain_id);setViceCaptainId(vice_captain_id);
    if (!boosterId) setPowerChoice({scope,role:'3X',playerId:booster_id});
    setSaveToast({type:'success',text:'AI suggestions applied to your draft only. Review and save your XI, then confirm the optional 3X booster.'});
  };

  // Save Team to Backend
  const handleSaveTeam = async () => {
    if (isSubmitting || loadedScope !== scope || loadError) return;
    const savingScope = scope;
    if (isCurrentMatchLocked) {
      alert('Lineup submissions are strictly locked for this match (deadline / admin lock). Team modifications are not permitted.');
      return;
    }
    if (!user) {
      pendingGuestDraft.current = {match_id:selectedMatch.id,player_ids:selectedPlayers.map(p=>p.id),captain_id:captainId,vice_captain_id:viceCaptainId};
      setIsAuthOpen(true);
      setSaveToast({
        type: 'error',
        text: 'Please sign in or register your account to submit your 11 players to the leaderboard.',
      });
      return;
    }
    if (selectedPlayers.length !== 11) {
      alert('Please select exactly 11 players before saving.');
      return;
    }
    if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
      setIsCaptainModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setSaveToast(null);

    try {
      const payload = {
        match_id: selectedMatch.id,
        player_ids: selectedPlayers.map((p) => p.id),
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
      };
      await api.post('/teams', payload);
      const confirmed = await api.get(`/teams/my-team?match_id=${payload.match_id}`);
      const team = confirmed.data.team;
      const expected = [...payload.player_ids].sort((a,b)=>a-b);
      const actual = (team?.players || []).map(p=>p.id).sort((a,b)=>a-b);
      if (!confirmed.data.has_team || JSON.stringify(expected) !== JSON.stringify(actual) ||
          team.captain_id !== payload.captain_id || team.vice_captain_id !== payload.vice_captain_id) {
        throw new Error('The saved team could not be verified. Reload before retrying.');
      }
      if (currentScope.current !== savingScope) return;

      const submissionDetails = {
        managerName: String(user.full_name || user.name || 'Fantasy Manager').trim(),
        fantasyTeamName: String(user.fantasy_team_name || 'My Fantasy XI').trim(),
        matchTitle: selectedMatch?.title || `${selectedMatch?.team_a || 'Team A'} vs ${selectedMatch?.team_b || 'Team B'}`,
        players: selectedPlayers.map((player) => ({
          id: player.id,
          name: player.name,
          team: player.team,
          role: player.role,
          designation: player.id === captainId
            ? 'CAPTAIN 2X'
            : player.id === viceCaptainId
              ? 'VICE 1.5X'
              : '',
        })),
      };
      if (powerChoice?.scope === savingScope && powerChoice.role && !team.power_booster_role) {
        setPowerPrompt({scope:savingScope, role:powerChoice.role, teamId:team.id, revision:team.lineup_revision, preferredPlayerId: draftTripleId, players:selectedPlayers.map(p=>({id:p.id,name:p.name,role:p.role,team:p.team})), captainId, viceCaptainId});
      } else {
        setSubmissionCelebration(submissionDetails);
      }
      playFantasySound('success');
      speakFantasySubmission(submissionDetails);

      setSavedSignature(squadSignature);
      window.dispatchEvent(new Event('fantasy-team-saved'));

      setSaveToast({
        type: 'success',
        text: 'Your 11-Player Fantasy Squad has been saved successfully to the server and entered into the leaderboard!',
      });
      setIsCaptainModalOpen(false);
      setIsMobilePitchOpen(false);
      loadMatches();
    } catch (err) {
      if (currentScope.current !== savingScope) return;
      setSavedSignature(null);
      console.error('Failed to save team:', err);
      setSaveToast({
        type: 'error',
        text: err.response?.data?.detail || err.message || 'Save could not be confirmed. Reload before retrying.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open synchronously; only the selected request may populate the modal.
  const handleInspectTeam = (teamId) => {
    if (teamId === inspectedTeamId) return;
    setInspectedTeamDetails(null);
    setIsInspecting(true);
    setInspectedTeamId(teamId);
  };
  useEffect(() => {
    setInspectedTeamId(null);
    setInspectedTeamDetails(null);
  }, [user?.id, token]);
  useEffect(() => {
    if (!inspectedTeamId) return;
    let active = true, busy = false, pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active || document.hidden) return;
      if (busy) { pending = true; return; }
      busy = true;
      try {
        const res = await api.get(`/leaderboard/team/${inspectedTeamId}`, { signal: controller.signal });
        if (active && !pending) { setInspectedTeamDetails(res.data); setIsInspecting(false); }
      } catch (err) {
        if (!active || err.code === 'ERR_CANCELED') return;
        setInspectedTeamDetails(null); setInspectedTeamId(null);
        setSaveToast({ type: 'error', text: err.response?.data?.detail || 'Could not load lineup preview. Please retry.' });
      } finally {
        busy = false;
        if (pending && active) { pending = false; refresh(); }
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    const changed = () => { if (active) { setInspectedTeamDetails(null); setIsInspecting(true); refresh(); } };
    const visible = () => { if (!document.hidden) changed(); };
    window.addEventListener('fantasy-data-changed', changed);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; controller.abort(); clearInterval(timer);
      window.removeEventListener('fantasy-data-changed', changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [inspectedTeamId, user?.id, token]);

  return (
    <div className="fantasy-app-shell min-h-screen bg-[#101827] text-slate-100 flex flex-col pb-16 lg:pb-6">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        hasMyTeam={isSquadSaved}
        myTeamName={user?.fantasy_team_name}
      />

      {/* Admin Simulation Controller Toolbar (ONLY visible to Ahmad Tahseen / Admin) */}
      {user?.is_admin && (
        <Suspense fallback={<p role="status">Loading admin controls…</p>}><AdminToolbar
          activeMatch={activeMatch}
          onSimulationComplete={loadMatches}
          onResetComplete={loadMatches}
          onLockToggle={loadMatches}
          onOpenAdminDashboard={() => setActiveTab('admin')}
        /></Suspense>
      )}

      {/* Main Container */}
      <main className="fantasy-main-content flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Active Match Dynamic Live Countdown Banner */}
        {sessionError && <p role="alert" className="mb-4 text-amber-300">{sessionError} <button className="underline" onClick={()=>window.location.reload()}>Reload</button></p>}
        {(loadError || matchesError) && <div role="alert" className="mb-4 p-3 border border-red-500 rounded">{loadError || matchesError} <button className="underline" onClick={() => {loadMatches(); setReloadTeam(n => n + 1);}}>Retry</button></div>}
        <SeriesHero match={activeMatch} onBuild={() => { setActiveTab('builder'); setTimeout(() => document.querySelector('.team-builder-shell')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50); }} onLeaderboard={() => setActiveTab('leaderboard')} />
        <MatchCountdownBanner match={activeMatch} />
        <LiveScores match={selectedMatch} />
        {user && selectedPlayers.length>0 && !isSquadSaved && <p className="mb-4 text-amber-300" role="status">Unsaved changes — use Save Lineup to submit your team.</p>}

        {/* Schedule & Fixture Carousel (Top of Page) */}
        <FixtureCarousel
          matches={matches}
          selectedMatch={selectedMatch}
          onSelectMatch={(m) => setSelectedMatch(m)}
        />

        {/* User Lineup Saved Confirmation */}
        {user && isSquadSaved && (
          <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-500 text-xs text-slate-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400 stroke-[3]" />
              <span>
                Your 11-player squad for <strong className="text-amber-300">{selectedMatch?.title}</strong> is saved. Points update when the administrator enters match statistics.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('builder')}
              className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold text-[11px]"
            >
              View My Squad
            </button>
          </div>
        )}

        {loadedScope !== scope && !loadError && <div role="status" className="mb-4 p-3">Loading players and saved team…</div>}

        {/* Save Toast notification */}
        {saveToast && (
          <div className={`mb-5 p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg ${
            saveToast.type === 'success'
              ? 'bg-slate-950/90 border-slate-500 text-slate-200'
              : 'bg-red-950/90 border-red-500 text-red-200'
          }`}>
            <span>{saveToast.text}</span>
            <button onClick={() => setSaveToast(null)} className="text-sm font-bold">✕</button>
          </div>
        )}

        <div className="flex gap-2 mb-4"><button className="px-4 py-2 rounded-xl border border-amber-400 text-amber-300 font-bold" onClick={() => setActiveTab(activeTab === 'engagement' ? 'builder' : 'engagement')}>{activeTab === 'engagement' ? 'Back to team builder' : 'Explore Fantasy Hub'}</button></div>
        {activeTab === 'engagement' && <Suspense fallback={<p role="status">Loading Fantasy Hub…</p>}><EngagementHub key={scope} matchId={selectedMatch?.id} user={user} onSignIn={()=>setIsAuthOpen(true)} /></Suspense>}

        {/* TAB 1: MATCH & TEAM BUILDER (DESKTOP & MOBILE LAYOUT) */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 60% Panel: Team Builder (Roles, Cards, Filters) */}
            <div className="lg:col-span-7 space-y-4">
              {user && selectedMatch?.score_revision > 0 && <LiveMyPoints key={scope} matchId={selectedMatch.id} revision={selectedMatch.score_revision} updatedAt={selectedMatch.stats_updated_at} savedSignature={savedSignature} boosterId={boosterId} userId={user.id} />}
              <PowerBoosters key={scope} scope={scope} matchId={selectedMatch?.id} userId={user?.id}
                locked={isCurrentMatchLocked || !selectedMatch?.is_active} busy={isSubmitting}
                choice={powerChoice?.scope===scope ? powerChoice.role : null}
                onChoose={role=>setPowerChoice({scope,role})}
                saved={powerPrompt?.scope===scope ? powerPrompt : null}
                onDismiss={()=>setPowerPrompt(null)} onStatus={setPowerStatus} />
              <SmartValidator match={selectedMatch} players={selectedPlayers} captainId={captainId} viceCaptainId={viceCaptainId} errors={validationErrors} locked={isCurrentMatchLocked} user={user}/>
              <Suspense fallback={null}><AiFantasyAssistant key={scope} players={allPlayers} selected={selectedPlayers} match={selectedMatch} reservedBoosterId={boosterId} locked={isCurrentMatchLocked || !selectedMatch?.is_active} busy={isSubmitting || loadedScope!==scope || Boolean(loadError)} onApply={applyAiDraft}/></Suspense>
              <TeamBuilder
                categorizedPlayers={categorizedPlayers}
                allPlayers={allPlayers}
                selectedPlayers={selectedPlayers}
                onTogglePlayer={handleTogglePlayer}
                onOpenMobilePitch={() => setIsMobilePitchOpen(true)}
                teamA={selectedMatch?.team_a || 'PAK'}
                teamB={selectedMatch?.team_b || 'SL'}
                isLocked={isCurrentMatchLocked}
                captainId={captainId}
                viceCaptainId={viceCaptainId}
                boosterId={boosterId}
                powerBoosterRole={powerStatus?.scope===scope ? powerStatus.active_role : null}
                onOpenRules={() => setIsRulesOpen(true)}
                selectedMatch={selectedMatch}
                activeMatch={activeMatch}
                onSelectMatch={(m) => setSelectedMatch(m)}
                onSaveTeam={handleSaveTeam}
                onOpenCaptainModal={() => { if (!isCurrentMatchLocked) setIsCaptainModalOpen(true); }}
              />
            </div>

            {/* Right 40% Sticky Panel: 2D/3D Green Turf Pitch Preview */}
            <div className="hidden lg:block lg:col-span-5 sticky top-24">
              <PitchPreview
                selectedPlayers={selectedPlayers}
                captainId={captainId}
                viceCaptainId={viceCaptainId}
                boosterId={boosterId}
                powerBoosterRole={powerStatus?.scope===scope ? powerStatus.active_role : null}
                onSetCaptain={handleSetCaptain}
                onSetViceCaptain={handleSetViceCaptain}
                        onRemovePlayer={handleRemovePlayer}
                onSaveTeam={handleSaveTeam}
                validationErrors={validationErrors}
                isSubmitting={isSubmitting || loadedScope !== scope || Boolean(loadError)}
                teamA={selectedMatch?.team_a || 'PAK'}
                teamB={selectedMatch?.team_b || 'SL'}
                isLocked={isCurrentMatchLocked}
                selectedMatch={selectedMatch}
              />
            </div>

          </div>
        )}

        {/* TAB 2: LEADERBOARD & WINNERS ARCHIVE */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            matches={matches}
            activeMatchId={selectedMatch?.id || 1}
            onInspectTeam={handleInspectTeam}
            onBuildTeam={() => {
              const targetMatch = matches.find((m) => m.id === (selectedMatch?.id || 1)) || activeMatch;
              if (targetMatch) setSelectedMatch(targetMatch);
              setActiveTab('builder');
            }}
          />
        )}

        {/* TAB 3: PAKISTAN A VS SRI LANKA A SERIES STANDINGS */}
        {activeTab === 'standings' && (
          <OdiSeriesStandings />
        )}

        {/* TAB 4: ADMIN DASHBOARD (ACCESSIBLE ONLY BY AHMAD TAHSEEN) */}
        {activeTab === 'admin' && (
          <Suspense fallback={<p role="status">Loading admin panel…</p>}><AdminDashboard
            activeMatch={activeMatch}
            onSimulationComplete={loadMatches}
            onLockToggle={loadMatches}
            onOpenAuth={() => setIsAuthOpen(true)}
          /></Suspense>
        )}

      </main>

      {/* Animated confirmation appears only after the server read-back verifies the XI. */}
      <TeamSubmissionCelebration
        details={submissionCelebration}
        onClose={() => setSubmissionCelebration(null)}
        onReplayVoice={() => speakFantasySubmission(submissionCelebration)}
      />

      {/* Mobile Slide-Up Drawer for Turf Pitch */}
      <MobileDrawer
        isOpen={isMobilePitchOpen}
        onClose={() => setIsMobilePitchOpen(false)}
        selectedPlayers={selectedPlayers}
        captainId={captainId}
        viceCaptainId={viceCaptainId}
        boosterId={boosterId}
        powerBoosterRole={powerStatus?.scope===scope ? powerStatus.active_role : null}
        onSetCaptain={handleSetCaptain}
        onSetViceCaptain={handleSetViceCaptain}
        onRemovePlayer={handleRemovePlayer}
        onSaveTeam={handleSaveTeam}
        validationErrors={validationErrors}
        isSubmitting={isSubmitting || loadedScope !== scope || Boolean(loadError)}
        teamA={selectedMatch?.team_a || 'PAK'}
        teamB={selectedMatch?.team_b || 'SL'}
        isLocked={isCurrentMatchLocked}
        selectedMatch={selectedMatch}
      />

      {/* Captain Selection Modal */}
      <CaptainModal
        isOpen={isCaptainModalOpen}
        onClose={() => setIsCaptainModalOpen(false)}
        selectedPlayers={selectedPlayers}
        captainId={captainId}
        viceCaptainId={viceCaptainId}
        boosterId={boosterId || draftTripleId}
        onSelectCaptain={handleSetCaptain}
        onSelectViceCaptain={handleSetViceCaptain}
        onSelectBooster={boosterId || isCurrentMatchLocked ? undefined : (pId) => setPowerChoice(pId ? { scope, role: '3X', playerId: pId } : null)}
        onConfirmSave={handleSaveTeam}
        isSubmitting={isSubmitting || loadedScope !== scope || Boolean(loadError)}
      />

      {/* Inspect User Team Pitch Modal (from Leaderboard) */}
      <UserTeamPitchModal
        isOpen={Boolean(inspectedTeamId)}
        onClose={() => { setInspectedTeamId(null); setInspectedTeamDetails(null); }}
        teamDetails={inspectedTeamDetails}
        loading={isInspecting}
        isAdmin={Boolean(user?.is_admin)}
        onRemoveTeam={async (teamId, teamName, managerName) => {
          if (!window.confirm(`Are you sure you want to permanently delete "${teamName || 'this team'}" (Manager: ${managerName || 'User'}) from the tournament leaderboard?`)) return;
          try {
            await api.delete(`/admin/teams/${teamId}`);
            window.dispatchEvent(new Event('fantasy-team-saved'));
            alert(`Team "${teamName}" removed successfully by Administrator.`);
            setInspectedTeamId(null);
            setInspectedTeamDetails(null);
            loadMatches();
          } catch (err) {
            alert(err.response?.data?.detail || 'Failed to remove team. Ensure you are signed in as administrator.');
          }
        }}
      />

      {/* Auth Modal (Sign In / Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenForgotPassword={() => setIsForgotOpen(true)}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        onBackToLogin={() => setIsAuthOpen(true)}
      />

      {/* Mandatory First-Login Onboarding Modal */}
      <OnboardingModal
        isOpen={Boolean(user && user.onboarding_required)}
      />

      {/* Manager Profile & Avatar Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Custom 50-over Fantasy Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

    </div>
  );
}

export default App;
