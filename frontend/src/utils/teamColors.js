// Shared team color utility for Pakistan A vs Sri Lanka A (ACC Rising Stars Final 2026)

export const teamColors = (team) => {
  if (team === 'PAK') {
    return 'bg-gradient-to-b from-[#08783E] to-[#01411C] border-[#34D399] text-white';
  }
  if (team === 'SL') {
    return 'bg-gradient-to-b from-[#1746A2] to-[#082567] border-[#F5C542] text-white';
  }
  // Historical fallbacks
  if (team === 'AUS') {
    return 'bg-gradient-to-b from-yellow-300 to-amber-500 border-emerald-700 text-emerald-950';
  }
  if (team === 'ENG') {
    return 'bg-gradient-to-b from-red-500 to-red-700 border-slate-900 text-white';
  }
  return 'bg-slate-700 border-slate-400 text-white';
};

export const teamBadgeStyle = {
  PAK: {
    name: 'Pakistan A',
    short: 'PAK',
    primary: '#08783E',
    dark: '#01411C',
    highlight: '#34D399',
    text: '#ffffff',
    border: '#34D399',
    gradient: 'linear-gradient(180deg, #08783E 0%, #01411C 100%)',
    pillClass: 'bg-[#08783E] text-white border border-[#34D399]'
  },
  SL: {
    name: 'Sri Lanka A',
    short: 'SL',
    primary: '#1746A2',
    dark: '#082567',
    border: '#F5C542',
    goldenBorder: '#F5C542',
    text: '#ffffff',
    gradient: 'linear-gradient(180deg, #1746A2 0%, #082567 100%)',
    pillClass: 'bg-[#1746A2] text-white border-2 border-[#F5C542]'
  }
};
