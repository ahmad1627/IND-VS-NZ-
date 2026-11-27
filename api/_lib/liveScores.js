// Read-only provider adapter: never changes fixtures, locks, users or points.
const INTERVAL = 15 * 60 * 1000;
function createLiveScores({ key, redis = null, fetcher = fetch, now = Date.now }) {
  let cache = null, nextAttempt = 0, pending = null;
  const cacheKey = 'cricketdata:rising-stars-final-2026:v1';
  const output = (value, state) => ({ state, provider: 'CricketData.org', refresh_minutes: 15,
    updated_at: value?.updated_at || null, matches: value?.matches || [] });
  async function refresh() {
    try {
      if (redis) {
        const shared = await redis.get(cacheKey);
        if (shared) cache = typeof shared === 'string' ? JSON.parse(shared) : shared;
        if (cache && now() - Date.parse(cache.updated_at) < INTERVAL) return output(cache, 'available');
        // Shared across instances; reserve one provider attempt per 15-minute window.
        const acquired = await redis.set(cacheKey + ':window', '1', { nx: true, ex: INTERVAL / 1000 });
        if (acquired !== 'OK') return output(cache, cache ? 'stale' : 'unavailable');
      }
      const response = await fetcher('https://api.cricapi.com/v1/currentMatches?apikey=' + encodeURIComponent(key) + '&offset=0', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('Provider unavailable');
      const body = await response.json();
      if (body.status !== 'success' || !Array.isArray(body.data)) throw Error('Invalid provider data');
      const matches = body.data.filter(m => ['odi','lista','list a'].includes(String(m.matchType).toLowerCase()) && Array.isArray(m.teams) && m.teams.some(t => /^(pakistan a|pakistan shaheens)$/i.test(t.trim())) && m.teams.some(t => /^sri lanka a$/i.test(t.trim())) && String(m.date || m.dateTimeGMT || '').slice(0,10) === '2026-11-29').map(m => ({
        id: String(m.id), name: String(m.name || 'Pakistan A vs Sri Lanka A'), date: String(m.date || m.dateTimeGMT || '').slice(0,10),
        status: String(m.status || ''), scores: (Array.isArray(m.score) ? m.score : []).map(s => ({ innings: String(s.inning || ''), runs: Number(s.r) || 0, wickets: Number(s.w) || 0, overs: Number(s.o) || 0 }))
      }));
      cache = { updated_at: new Date(now()).toISOString(), matches };
      if (redis) await redis.set(cacheKey, JSON.stringify(cache), { ex: 172800 });
      return output(cache, 'available');
    } catch { return output(cache, cache ? 'stale' : 'unavailable'); }
  }
  return async function getScores() {
    if (!key) return output(null, 'disabled');
    if (pending) return pending;
    if (now() < nextAttempt) return output(cache, cache && now()-Date.parse(cache.updated_at)<INTERVAL ? 'available' : cache ? 'stale' : 'unavailable');
    nextAttempt = now() + INTERVAL;
    pending = refresh();
    try { return await pending; } finally { pending = null; }
  };
}
module.exports = { createLiveScores };
