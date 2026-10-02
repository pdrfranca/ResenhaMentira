export type AvatarId = "cat" | "alien" | "wizard" | "toast" | "ghost" | "frog";
export type Phase = "lobby" | "answering" | "voting" | "reveal" | "finished";

export type Player = {
  id: string;
  name: string;
  avatar: AvatarId;
  accent: string;
  host?: boolean;
  score: number;
  online?: boolean;
  ready?: boolean;
};

export type GameState = {
  phase: Phase;
  round: number;
  totalRounds: number;
  targetId: string | null;
  question: string;
  answers: string[];
  correctIndex: number | null;
  votes: Record<string, number>;
  votingDone: string[];
  theme: string | null;
  doublePoints: boolean;
  chaosUsed: boolean;
  chaosBy: string | null;
  specialChosen: boolean;
  lastResult: { winnerText: string; answerIndex: number | null } | null;
};

export type WireMessage =
  | { type: "hello"; player: Player }
  | { type: "request_state"; playerId: string }
  | { type: "state"; state: GameState; players: Player[] }
  | { type: "set_ready"; playerId: string; ready: boolean }
  | { type: "start_game"; state: GameState }
  | { type: "submit_answers"; playerId: string; answers: string[]; correctIndex: number }
  | { type: "vote"; playerId: string; answerIndex: number }
  | { type: "use_chaos"; playerId: string }
  | { type: "choose_theme"; theme: string }
  | { type: "chat"; playerId: string; text: string };
