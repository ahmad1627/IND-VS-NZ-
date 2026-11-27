// Only in-flight GETs are shared. No resolved response or private lineup cache.
export function createReadPool(fetcher, context) {
  const pending = new Map();
  const canceled = () => Object.assign(new Error('Request canceled'), { code: 'ERR_CANCELED' });
  const clear = () => {
    for (const entry of pending.values()) entry.controller.abort();
    pending.clear();
  };
  let owner = context();
  function get(url, config = {}) {
    const current = context();
    if (owner !== current) { clear(); owner = current; }
    if (config.signal?.aborted) return Promise.reject(canceled());
    // Custom headers/response formats retain Axios semantics and are not coalesced.
    if (Object.keys(config).some(k => !['signal', 'params'].includes(k))) return fetcher(url, config);
    const key = JSON.stringify([current, url, config.params || null]);
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, users: 0 };
      entry.promise = Promise.resolve().then(() => fetcher(url, { ...config, signal: controller.signal })).then(value => {
        if (controller.signal.aborted || context() !== current) throw canceled();
        return value;
      }).finally(() => { if (pending.get(key) === entry) pending.delete(key); });
      pending.set(key, entry);
    }
    entry.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const settle = (fn, value) => {
        if (finished) return;
        finished = true;
        config.signal?.removeEventListener('abort', abort);
        if (--entry.users === 0 && pending.get(key) === entry) {
          pending.delete(key); entry.controller.abort();
        }
        fn(value);
      };
      const abort = () => settle(reject, canceled());
      config.signal?.addEventListener('abort', abort, { once: true });
      entry.promise.then(value => settle(resolve, value), error => settle(reject, error));
    });
  }
  return { get, clear };
}
