// Attach a snapshot to callers that omit it, so batched duplicate actions cannot
// consume successive turns. Explicit snapshots (including stale ones) survive.
function createGuardedDispatch(dispatch, getState) {
  return (action) => {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return dispatch(action);
    return dispatch('expectedState' in action ? action : { ...action, expectedState: getState() });
  };
}
module.exports = { createGuardedDispatch };
