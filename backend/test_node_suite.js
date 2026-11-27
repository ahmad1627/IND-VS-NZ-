const assert = require('node:assert/strict');
const { PLAYERS_DATA: p, MATCHES_DATA: m, COMPETITION_ID } = require('../api/_lib/seedData');
const { calculateTeamPoints } = require('../api/_lib/scoringEngine');

assert.equal(COMPETITION_ID, 'ACC_RISING_STARS_FINAL_2026');
assert.equal(p.length, 30);
assert.equal(new Set(p.map(x => x.id)).size, 30);
assert.equal(new Set(p.map(x => x.name)).size, 30);

// Exactly 15 Pakistan A players and 15 Sri Lanka A players
assert.equal(p.filter(x => x.team === 'PAK').length, 15);
assert.equal(p.filter(x => x.team === 'SL').length, 15);

// Role distribution: WK: 3, BAT: 10, AR: 8, BOWL: 9
assert.equal(p.filter(x => x.role === 'WK').length, 3);
assert.equal(p.filter(x => x.role === 'BAT').length, 10);
assert.equal(p.filter(x => x.role === 'AR').length, 8);
assert.equal(p.filter(x => x.role === 'BOWL').length, 9);

// Official captains
assert.equal(p.find(x => x.id === 502).is_captain, true); // Abdul Samad
assert.equal(p.find(x => x.id === 603).is_captain, true); // Pavan Rathnayake
assert.equal(p.filter(x => x.is_captain).length, 2);

// Exactly ONE active match: Final Pakistan A vs Sri Lanka A
assert.equal(m.length, 1);
const finalMatch = m[0];
assert.equal(finalMatch.id, 1);
assert.equal(finalMatch.match_number, 1);
assert.equal(finalMatch.match_date, '2026-11-29T10:00:00.000Z');
assert.equal(finalMatch.team_a, 'PAK');
assert.equal(finalMatch.team_b, 'SL');
assert.equal(finalMatch.format, '50-over');
assert.equal(p.filter(x => x.match_eligibility.includes(1)).length, 30);

// Multiplier tests: Base 10 pts -> C: 20 pts (2X), VC: 15 pts (1.5X), 3X: 30 pts (3X)
const r = calculateTeamPoints({ 501: 10, 502: 10, 503: 10, 504: 10 }, 501, 502, 503);
assert.deepEqual(r.effectivePtsMap, { 501: 20, 502: 15, 503: 10, 504: 10 });
assert.equal(r.totalPoints, 55);

const triple = calculateTeamPoints({ 501: 10, 502: 10, 503: 10, 504: 10 }, 501, 502, 503, '3X');
assert.deepEqual(triple.effectivePtsMap, { 501: 20, 502: 15, 503: 30, 504: 10 });
assert.equal(triple.totalPoints, 75);

console.log('PASS: roster counts, ACC Rising Stars Final match, role distribution, and 3X scoring.');
