const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyDerivedState,
  applyScoreDelta,
  createDefaultState,
  setCurrentGameScore,
  startNextGame,
  updateTeams
} = require("../src/match-logic");

test("a game is won at 21-19 by default", () => {
  const state = applyDerivedState(createDefaultState());
  const scored = setCurrentGameScore(state, 21, 19);

  assert.equal(scored.games[0].winner, "a");
  assert.equal(scored.summary.winsA, 1);
  assert.equal(scored.summary.canStartNextGame, true);
});

test("20-20 does not create a winner yet", () => {
  const state = applyDerivedState(createDefaultState());
  const scored = setCurrentGameScore(state, 20, 20);

  assert.equal(scored.games[0].winner, null);
  assert.equal(scored.summary.currentGameComplete, false);
});

test("30-29 is a win at the hard cap", () => {
  const state = applyDerivedState(createDefaultState());
  const scored = setCurrentGameScore(state, 30, 29);

  assert.equal(scored.games[0].winner, "a");
});

test("next game starts after a completed opener", () => {
  const state = applyDerivedState(createDefaultState());
  const firstGameFinished = setCurrentGameScore(state, 21, 15);
  const nextGameState = startNextGame(firstGameFinished);

  assert.equal(nextGameState.games.length, 2);
  assert.equal(nextGameState.games[1].scoreA, 0);
  assert.equal(nextGameState.summary.activeGameNumber, 2);
});

test("match winner is declared after two game wins in best of three", () => {
  let state = applyDerivedState(createDefaultState());
  state = setCurrentGameScore(state, 21, 10);
  state = startNextGame(state);
  state = setCurrentGameScore(state, 21, 17);

  assert.equal(state.summary.matchWinner, "a");
});

test("score buttons stop changing a completed game until the next one is started", () => {
  let state = applyDerivedState(createDefaultState());
  state = setCurrentGameScore(state, 21, 9);
  state = applyScoreDelta(state, "b", 1);

  assert.equal(state.games[0].scoreB, 9);
});

test("team updates keep finals images and profile fields in state", () => {
  const state = applyDerivedState(createDefaultState());
  const updated = updateTeams(state, {
    a: {
      imageUrl: "https://example.com/left.png",
      profile: {
        racket: "Astrox 88D",
        age: "23",
        hand: "Right",
        nationality: "Ireland",
        club: "Tallaght"
      }
    },
    b: {
      imageUrl: "https://example.com/right.png",
      profile: {
        racket: "Arcsaber 11",
        age: "27",
        hand: "Left",
        nationality: "Spain",
        club: "Madrid Central"
      }
    }
  });

  assert.equal(updated.teams.a.imageUrl, "https://example.com/left.png");
  assert.equal(updated.teams.b.imageUrl, "https://example.com/right.png");
  assert.equal(updated.teams.a.profile.racket, "Astrox 88D");
  assert.equal(updated.teams.a.profile.age, "23");
  assert.equal(updated.teams.a.profile.hand, "Right");
  assert.equal(updated.teams.a.profile.nationality, "Ireland");
  assert.equal(updated.teams.a.profile.club, "Tallaght");
  assert.equal(updated.teams.b.profile.racket, "Arcsaber 11");
  assert.equal(updated.teams.b.profile.age, "27");
  assert.equal(updated.teams.b.profile.hand, "Left");
  assert.equal(updated.teams.b.profile.nationality, "Spain");
  assert.equal(updated.teams.b.profile.club, "Madrid Central");
});

