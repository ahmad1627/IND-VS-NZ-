// Extracted unchanged from the existing server submission rules.
module.exports = function composition(db, match, player_ids) {
 const matchId = match.id;
  // Fetch players and validate team composition
  const teamA = match.team_a;
  const teamB = match.team_b;
  const teamCounts = { [teamA]: 0, [teamB]: 0 };
  const roleCounts = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };

  for (const pId of player_ids) {
    const p = db.getPlayerForMatch(pId, match.id);
    if (!p) {
      return ({ detail: `Invalid player ID: ${pId}` });
    }
    if (p.team !== teamA && p.team !== teamB) {
      return ({ detail: `Player ${p.name} does not belong to competing teams (${teamA} vs ${teamB}).` });
    }
    if (!Array.isArray(p.match_eligibility) || !p.match_eligibility.includes(matchId) || p.availability_status === 'OUT' || p.active === false) {
      return ({ detail: `${p.name} is not eligible for this match.` });
    }
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  }

  if (teamCounts[teamA] < 1 || teamCounts[teamB] < 1) {
    return ({ detail: 'You must select at least 1 player from each team.' });
  }
  if (teamCounts[teamA] > 7 || teamCounts[teamB] > 7) {
    return ({ detail: 'Maximum 7 players allowed from a single team.' });
  }

  // Strict role limits
  if (roleCounts.WK < 1 || roleCounts.WK > 4) {
    return ({ detail: `Wicketkeepers (WK) must be between 1 and 4 (you have ${roleCounts.WK}).` });
  }
  if (roleCounts.BAT < 3 || roleCounts.BAT > 6) {
    return ({ detail: `Batters (BAT) must be between 3 and 6 (you have ${roleCounts.BAT}).` });
  }
  if (roleCounts.AR < 1 || roleCounts.AR > 4) {
    return ({ detail: `All-Rounders (AR) must be between 1 and 4 (you have ${roleCounts.AR}).` });
  }
  if (roleCounts.BOWL < 3 || roleCounts.BOWL > 6) {
    return ({ detail: `Bowlers (BOWL) must be between 3 and 6 (you have ${roleCounts.BOWL}).` });
  }

 return null;
};
