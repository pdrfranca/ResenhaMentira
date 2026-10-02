import type { GameState, Player } from "@/types/game";
import { pickQuestion } from "@/lib/questions";

export const TOTAL_ROUNDS = 12;

export function makeInitialState(): GameState {
  return {
    phase: "lobby",
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    targetId: null,
    question: "",
    answers: [],
    correctIndex: null,
    votes: {},
    votingDone: [],
    theme: null,
    doublePoints: false,
    chaosUsed: false,
    chaosBy: null,
    specialChosen: false,
    lastResult: null,
  };
}

export function startNextRound(state: GameState, players: Player[], forceTheme?: string): GameState {
  const round = state.round + 1;
  const targetId = players[(round - 1) % players.length]?.id ?? null;
  const special = round === 6 || Boolean(forceTheme);
  return {
    ...state,
    phase: "answering",
    round,
    targetId,
    question: pickQuestion(round),
    answers: [],
    correctIndex: null,
    votes: {},
    votingDone: [],
    theme: special ? (forceTheme ?? state.theme ?? "Escolha um tema") : null,
    doublePoints: special,
    lastResult: null,
    chaosBy: null,
  };
}

export function allVoters(players: Player[], targetId: string | null) {
  return players.filter((p) => p.id !== targetId);
}
