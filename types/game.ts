export type AvatarId =
  | "fox"
  | "cat"
  | "alien"
  | "robot"
  | "frog"
  | "ghost"
  | "duck"
  | "skull";

export type Player = {
  id: string;
  name: string;
  avatar: AvatarId;
  color: string;
  score: number;
  host?: boolean;
};

export type Theme =
  | "Escola"
  | "Trabalho"
  | "Família"
  | "Viagem"
  | "Internet"
  | "Primeiros encontros";

export type Phase =
  | "lobby"
  | "special-theme"
  | "answering"
  | "voting"
  | "reveal"
  | "finished";

export type PublicRound = {
  number: number;
  targetId: string;
  question: string;
  answers: string[];
  correctIndex: number;
  theme?: Theme;
  doublePoints: boolean;
  submitted: boolean;
  votedIds: string[];
};

export type RoundResult = {
  correctAnswer: number;
  winners: string[];
  winnerPoints: number;
  targetPoints: number;
};

export type GameState = {
  phase: Phase;
  round: PublicRound;
  players: Player[];
  result: RoundResult | null;
  chaosUsed: boolean;
  chaos?: {
    active: boolean;
    by: string;
    returnTo: "answering" | "voting";
    startedAt: number;
  } | null;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  avatar: AvatarId;
  color: string;
  text: string;
  createdAt: number;
};

export type WireEvent =
  | { type: "STATE_REQUEST"; from: string }
  | { type: "STATE_SYNC"; state: GameState }
  | { type: "START_GAME"; state: GameState }
  | { type: "SELECT_THEME"; theme: Theme; from: string }
  | {
      type: "SUBMIT_ANSWERS";
      from: string;
      answers: string[];
      correctIndex: number;
    }
  | { type: "CAST_VOTE"; from: string; answerIndex: number }
  | { type: "START_CHAOS"; from: string; returnTo: "answering" | "voting" }
  | { type: "END_CHAOS" }
  | { type: "CHAT"; message: ChatMessage };
