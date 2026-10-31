// Deterministic same-origin Web Locks implementation for the browser test harness.
function createBrowserLocks() {
  const queues = new Map();
  return { request(name, options, work) {
    const prior = queues.get(name) ?? Promise.resolve();
    const result = prior.catch(() => {}).then(() => {
      if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return work({ name });
    });
    queues.set(name, result);
    return result.finally(() => { if (queues.get(name) === result) queues.delete(name); });
  } };
}
function installBrowserLocks() {
  Object.defineProperty(global, 'navigator', { configurable: true, value: { ...global.navigator, locks: createBrowserLocks() } });
}
module.exports = { createBrowserLocks, installBrowserLocks };
