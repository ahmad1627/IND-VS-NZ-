export function soundEnabled() { try { return localStorage.getItem('fantasy_sound') !== 'off'; } catch { return true; } }
let sharedAudioContext = null;

/**
 * Plays small UI sounds with the Web Audio API, so no external audio files
 * or asset-folder setup are required.
 */
export const playFantasySound = (action = 'add') => {
  if (typeof window === 'undefined' || !soundEnabled()) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    sharedAudioContext = sharedAudioContext || new AudioContextClass();
    const context = sharedAudioContext;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const soundSets = {
      add: [
        { frequency: 620, endFrequency: 880, start: 0, duration: 0.12, type: 'sine' },
        { frequency: 880, endFrequency: 1120, start: 0.09, duration: 0.13, type: 'sine' },
      ],
      remove: [
        { frequency: 470, endFrequency: 250, start: 0, duration: 0.19, type: 'triangle' },
      ],
      success: [
        { frequency: 523.25, endFrequency: 659.25, start: 0, duration: 0.2, type: 'sine' },
        { frequency: 659.25, endFrequency: 783.99, start: 0.16, duration: 0.22, type: 'sine' },
        { frequency: 783.99, endFrequency: 1046.5, start: 0.34, duration: 0.34, type: 'sine' },
      ],
    };

    (soundSets[action] || soundSets.add).forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = now + tone.start;
      const endAt = startAt + tone.duration;

      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), endAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });
  } catch (error) {
    // Audio is an enhancement only; player selection must still work silently.
    console.debug('Fantasy UI sound is unavailable in this browser.', error);
  }
};

/** Speaks the successful submission announcement with the browser's voice. */
export const speakFantasySubmission = ({ managerName, fantasyTeamName, matchTitle }) => {
  if (typeof window === 'undefined' || !soundEnabled() || !window.speechSynthesis) return false;

  const Utterance = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  if (!Utterance) return false;

  const manager = String(managerName || 'Fantasy Manager').trim();
  const fantasyTeam = String(fantasyTeamName || 'My Fantasy XI').trim();
  const match = String(matchTitle || '').trim();
  const message = `Congratulations, ${manager}. Your fantasy team, ${fantasyTeam}, has been successfully submitted${match ? ` for ${match}` : ''}.`;

  try {
    const announcement = new Utterance(message);
    announcement.lang = 'en-US';
    announcement.rate = 0.94;
    announcement.pitch = 1.02;
    announcement.volume = 1;

    const availableVoices = window.speechSynthesis.getVoices?.() || [];
    const englishVoice = availableVoices.find((voice) => /^en(-|_)/i.test(voice.lang));
    if (englishVoice) announcement.voice = englishVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.();
    window.speechSynthesis.speak(announcement);
    return true;
  } catch (error) {
    console.debug('Spoken fantasy confirmation is unavailable in this browser.', error);
    return false;
  }
};
