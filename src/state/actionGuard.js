// Share one short cooldown across all human controls, including across renders.
function createActionGuard(now = Date.now) {
  let lastActionAt = -Infinity;
  return () => {
    const time = now();
    if (time - lastActionAt < 350) return false;
    lastActionAt = time;
    return true;
  };
}
module.exports = { createActionGuard };
