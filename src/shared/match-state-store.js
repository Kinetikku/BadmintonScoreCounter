const {
  applyDerivedState,
  prepareUndoSnapshot,
  toPublicState
} = require("../match-logic");

function hydrateState(rawState) {
  return applyDerivedState(rawState);
}

function applyManagedMutation(state, mutator) {
  const snapshot = prepareUndoSnapshot(state);
  const nextState = mutator(structuredClone(state));
  const derivedState = applyDerivedState(nextState);

  derivedState.history = [...(state.history || []), snapshot].slice(-50);
  return derivedState;
}

function applyManagedUndo(state) {
  if (!state.history?.length) {
    return state;
  }

  const previous = state.history[state.history.length - 1];
  const remainingHistory = state.history.slice(0, -1);
  const restoredState = applyDerivedState(previous);
  restoredState.history = remainingHistory;
  return restoredState;
}

function getPublicState(state) {
  return toPublicState(state);
}

module.exports = {
  applyManagedMutation,
  applyManagedUndo,
  getPublicState,
  hydrateState
};
