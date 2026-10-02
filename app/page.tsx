"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { animate, createScope, stagger } from "animejs";
import ThreeBackground from "@/components/three-background";
import { createBrowserSupabase, readSupabaseConfig, saveSupabaseConfig, type SupabaseConfig } from "@/lib/supabase";
import { getQuestion, themes } from "@/lib/questions";
import type { AvatarId, ChatMessage, GameState, Phase, Player, Theme, WireEvent } from "@/types/game";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const AVATARS: { id: AvatarId; emoji: string; label: string }[] = [
  { id: "fox", emoji: "🦊", label: "Raposa" },
  { id: "cat", emoji: "🐱", label: "Gato" },
  { id: "alien", emoji: "👽", label: "Alien" },
  { id: "robot", emoji: "🤖", label: "Robô" },
  { id: "frog", emoji: "🐸", label: "Sapo" },
  { id: "ghost", emoji: "👻", label: "Fantasma" },
  { id: "duck", emoji: "🦆", label: "Pato" },
  { id: "skull", emoji: "💀", label: "Caveira" }
];

const COLORS = ["#9d7cff", "#47e4ff", "#ff5ca8", "#51e3a4", "#ffc857", "#ff8a4c"];
const ROOM_KEY = "mentira-profissional:room";
const PROFILE_KEY = "mentira-profissional:profile";
const letters = ["A", "B", "C"] as const;

const defaultRound = (targetId = "") => ({
  number: 1,
  targetId,
  question: getQuestion(1),
  answers: ["", "", ""],
  doublePoints: false,
  submitted: false,
  votedIds: []
});

const avatarById = (id: AvatarId) => AVATARS.find((item) => item.id === id) ?? AVATARS[0];

function createPlayerProfile(name: string, avatar: AvatarId, color: string, id: string): Player {
  return { id, name, avatar, color, score: 0 };
}

function makePlayerId() {
  return crypto.randomUUID();
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function isPlayer(value: unknown): value is Player {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Player>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.avatar === "string" && typeof item.color === "string" && typeof item.score === "number";
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [profile, setProfile] = useState<Player>(() => createPlayerProfile("Jogador", "fox", COLORS[0], ""));
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>("fox");
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [roomCode, setRoomCode] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState(defaultRound());
  const [result, setResult] = useState<GameState["result"]>(null);
  const [chaosUsed, setChaosUsed] = useState(false);
  const [chaosOverlay, setChaosOverlay] = useState<GameState["chaos"]>(null);
  const [localAnswers, setLocalAnswers] = useState(["", "", ""]);
  const [localCorrect, setLocalCorrect] = useState(0);
  const [localVote, setLocalVote] = useState<number | null>(null);
  const [themeError, setThemeError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const profileRef = useRef(profile);
  const playersRef = useRef(players);
  const roomCodeRef = useRef(roomCode);
  const hostIdRef = useRef<string>("");
  const secretCorrectRef = useRef(0);
  const secretVotesRef = useRef<Record<string, number>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const chaosTimeoutRef = useRef<number | null>(null);

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

  const lastAnswerRoundRef = useRef(0);
  useEffect(() => {
    if (round.number !== lastAnswerRoundRef.current) {
      lastAnswerRoundRef.current = round.number;
      setLocalAnswers(["", "", ""]);
      setLocalCorrect(0);
      setLocalVote(null);
    }
  }, [round.number]);

  const currentPlayer = profile;
  const target = players.find((player) => player.id === round.targetId);
  const isHost = currentPlayer.id !== "" && currentPlayer.id === hostIdRef.current;
  const isTarget = currentPlayer.id !== "" && currentPlayer.id === round.targetId;
  const myVoteDone = round.votedIds.includes(currentPlayer.id);
  const allVoted = round.votedIds.length >= Math.max(0, players.length - 1);

  useEffect(() => {
    const savedProfile = window.localStorage.getItem(PROFILE_KEY);
    const savedRoom = window.localStorage.getItem(ROOM_KEY);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as Partial<Player>;
        if (isPlayer({ ...parsed, score: parsed.score ?? 0 })) {
          const id = parsed.id || makePlayerId();
          setProfile(createPlayerProfile(parsed.name || "Jogador", parsed.avatar as AvatarId, parsed.color || COLORS[0], id));
          setDraftName(parsed.name || "Jogador");
          setDraftAvatar(parsed.avatar as AvatarId);
          setDraftColor(parsed.color || COLORS[0]);
        }
      } catch {
        // Ignore old local profile.
      }
    } else {
      const id = makePlayerId();
      const initial = createPlayerProfile("Jogador", "fox", COLORS[0], id);
      setProfile(initial);
      setDraftName(initial.name);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(initial));
    }
    setSupabaseConfig(readSupabaseConfig());
    if (savedRoom) setRoomInput(savedRoom);
  }, []);

  const applyState = useCallback((nextState: GameState) => {
    stateRef.current = nextState;
    setPhase(nextState.phase);
    setRound(nextState.round);
    setPlayers(nextState.players);
    setResult(nextState.result);
    setChaosUsed(nextState.chaosUsed);
    if (nextState.chaos) setChaosOverlay(nextState.chaos);
    if (nextState.phase === "answering" && nextState.round.targetId !== profileRef.current.id) {
      setLocalAnswers(["", "", ""]);
      setLocalCorrect(0);
    }
    if (nextState.phase === "voting") setLocalVote(null);
  }, []);

  const sendEvent = useCallback(async (event: WireEvent) => {
    const channel = channelRef.current;
    if (!channel) throw new Error("A sala ainda não está conectada.");
    const response = await channel.send({ type: "broadcast", event: event.type, payload: event });
    if (response !== "ok") throw new Error("O servidor de tempo real não confirmou a mensagem.");
  }, []);

  const disconnect = useCallback(async () => {
    if (chaosTimeoutRef.current) window.clearTimeout(chaosTimeoutRef.current);
    chaosTimeoutRef.current = null;
    if (channelRef.current && supabaseRef.current) {
      await supabaseRef.current.removeChannel(channelRef.current);
    }
    channelRef.current = null;
    supabaseRef.current = null;
    hostIdRef.current = "";
    stateRef.current = null;
    setConnectionStatus("Desconectado");
  }, []);

  const connectToRoom = useCallback(async (code: string, role: "host" | "guest") => {
    const config = readSupabaseConfig();
    if (!config) {
      setShowSetup(true);
      setConnectionError("Configure o Supabase primeiro. Isso é o motor que conecta os computadores.");
      return false;
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 5) {
      setConnectionError("O código da sala precisa ter 5 caracteres.");
      return false;
    }

    await disconnect();
    setConnectionError("");
    setConnectionStatus("Conectando...");
    const supabase = createBrowserSupabase(config);
    const channel = supabase.channel(`mentira:${cleanCode}`, {
      config: {
        broadcast: { self: true, ack: true },
        presence: { key: profileRef.current.id }
      }
    });

    const handleWire = async (payload: { payload?: WireEvent }) => {
      const event = payload.payload;
      if (!event || typeof event.type !== "string") return;

      if (event.type === "STATE_REQUEST") {
        if (hostIdRef.current === profileRef.current.id && stateRef.current) {
          try { await sendEvent({ type: "STATE_SYNC", state: cloneState(stateRef.current) }); } catch {}
        }
        return;
      }

      if (event.type === "STATE_SYNC" || event.type === "START_GAME") {
        const announcedHost = event.state.players.find((player) => player.host)?.id;
        if (announcedHost) hostIdRef.current = announcedHost;
        applyState(event.state);
        return;
      }

      if (event.type === "CHAT") {
        setMessages((current) => {
          if (current.some((message) => message.id === event.message.id)) return current;
          return [...current, event.message].slice(-120);
        });
        return;
      }

      if (event.type === "SELECT_THEME") {
        if (hostIdRef.current !== profileRef.current.id || stateRef.current?.phase !== "special-theme") return;
        const state = cloneState(stateRef.current);
        state.round.theme = event.theme;
        state.round.question = getQuestion(6, event.theme);
        state.round.doublePoints = true;
        state.phase = "answering";
        state.round.submitted = false;
        state.round.votedIds = [];
        secretVotesRef.current = {};
        secretCorrectRef.current = 0;
        applyState(state);
        try { await sendEvent({ type: "STATE_SYNC", state }); } catch {}
        return;
      }

      if (event.type === "SUBMIT_ANSWERS") {
        if (hostIdRef.current !== profileRef.current.id || stateRef.current?.phase !== "answering") return;
        const state = cloneState(stateRef.current);
        if (event.from !== state.round.targetId) return;
        if (event.answers.length !== 3 || event.answers.some((answer) => answer.trim().length < 2)) return;
        const correctIndex = Math.min(2, Math.max(0, event.correctIndex));
        state.round.answers = event.answers.map((answer) => answer.trim());
        state.round.submitted = true;
        state.round.votedIds = [];
        secretCorrectRef.current = correctIndex;
        secretVotesRef.current = {};
        state.phase = "voting";
        applyState(state);
        try { await sendEvent({ type: "STATE_SYNC", state }); } catch {}
        return;
      }

      if (event.type === "CAST_VOTE") {
        if (hostIdRef.current !== profileRef.current.id || stateRef.current?.phase !== "voting") return;
        const state = cloneState(stateRef.current);
        if (event.from === state.round.targetId || state.round.votedIds.includes(event.from)) return;
        if (!playersRef.current.some((player) => player.id === event.from)) return;
        secretVotesRef.current[event.from] = Math.min(2, Math.max(0, event.answerIndex));
        state.round.votedIds = [...state.round.votedIds, event.from];

        if (state.round.votedIds.length >= Math.max(0, playersRef.current.length - 1)) {
          const correct = secretCorrectRef.current;
          const winnerIds = playersRef.current.filter((player) => player.id !== state.round.targetId && secretVotesRef.current[player.id] === correct).map((player) => player.id);
          const winnerPoints = winnerIds.length > 0 ? (state.round.doublePoints ? 2 : 1) : 0;
          const targetPoints = winnerIds.length === 0 ? (state.round.doublePoints ? 6 : 3) : 0;
          state.players = playersRef.current.map((player) => {
            if (player.id === state.round.targetId) return { ...player, score: player.score + targetPoints };
            if (winnerIds.includes(player.id)) return { ...player, score: player.score + winnerPoints };
            return player;
          });
          state.result = {
            correctAnswer: correct,
            winners: winnerIds,
            winnerPoints,
            targetPoints
          };
          state.phase = "reveal";
        }

        applyState(state);
        try { await sendEvent({ type: "STATE_SYNC", state }); } catch {}
        return;
      }

      if (event.type === "START_CHAOS") {
        if (hostIdRef.current !== profileRef.current.id || stateRef.current?.chaosUsed) return;
        const state = cloneState(stateRef.current);
        state.chaosUsed = true;
        state.chaos = { active: true, by: event.from, returnTo: event.returnTo, startedAt: Date.now() };
        applyState(state);
        try { await sendEvent({ type: "STATE_SYNC", state }); } catch {}
        window.setTimeout(async () => {
          if (hostIdRef.current !== profileRef.current.id || !stateRef.current) return;
          const next = cloneState(stateRef.current);
          next.chaos = { active: false, by: event.from, returnTo: event.returnTo, startedAt: Date.now() };
          applyState(next);
          try { await sendEvent({ type: "STATE_SYNC", state: next }); } catch {}
        }, 15000);
      }
    };

    channel
      .on("broadcast", { event: "STATE_REQUEST" }, handleWire)
      .on("broadcast", { event: "STATE_SYNC" }, handleWire)
      .on("broadcast", { event: "START_GAME" }, handleWire)
      .on("broadcast", { event: "SELECT_THEME" }, handleWire)
      .on("broadcast", { event: "SUBMIT_ANSWERS" }, handleWire)
      .on("broadcast", { event: "CAST_VOTE" }, handleWire)
      .on("broadcast", { event: "START_CHAOS" }, handleWire)
      .on("broadcast", { event: "END_CHAOS" }, handleWire)
      .on("broadcast", { event: "CHAT" }, handleWire)
      .on("presence", { event: "sync" }, async () => {
        const presence = channel.presenceState();
        const online: Player[] = [];
        Object.values(presence).forEach((entries) => {
          const entry = entries[0] as Partial<Player> | undefined;
          if (entry && isPlayer(entry)) online.push({ ...entry });
        });
        if (!online.some((player) => player.id === profileRef.current.id)) online.push(profileRef.current);
        online.sort((a, b) => a.id.localeCompare(b.id));
        const existing = stateRef.current;
        if (existing?.phase === "lobby") {
          const presenceHost = online.find((player) => player.host)?.id;
          const hostId = hostIdRef.current || presenceHost || (role === "host" ? profileRef.current.id : "");
          if (hostId) hostIdRef.current = hostId;
          const roster = online.slice(0, 6).map((player) => ({ ...player, host: !!hostId && player.id === hostId }));
          setPlayers(roster);
          const next = cloneState(existing);
          next.players = roster;
          stateRef.current = next;
        } else {
          const currentHostOnline = !hostIdRef.current || online.some((player) => player.id === hostIdRef.current);
          const electedHost = [...online].sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
          if (!currentHostOnline && electedHost) hostIdRef.current = electedHost;

          setPlayers((current) => current.map((player) => {
            const onlinePlayer = online.find((item) => item.id === player.id);
            return onlinePlayer ? { ...player, name: onlinePlayer.name, avatar: onlinePlayer.avatar, color: onlinePlayer.color, host: player.id === hostIdRef.current } : player;
          }).filter((player) => online.some((item) => item.id === player.id)));

          if (!currentHostOnline && electedHost === profileRef.current.id && stateRef.current) {
            const promoted = cloneState(stateRef.current);
            promoted.players = promoted.players.map((player) => ({ ...player, host: player.id === electedHost }));
            hostIdRef.current = electedHost;
            stateRef.current = promoted;
            applyState(promoted);
            try { await sendEvent({ type: "STATE_SYNC", state: promoted }); } catch {}
          }
        }
      })
      .subscribe(async (status, error) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("Conectado");
          await channel.track({
            id: profileRef.current.id,
            name: profileRef.current.name,
            avatar: profileRef.current.avatar,
            color: profileRef.current.color,
            score: profileRef.current.score,
            host: hostIdRef.current === profileRef.current.id,
            online_at: new Date().toISOString()
          });
          if (role === "guest") {
            try { await sendEvent({ type: "STATE_REQUEST", from: profileRef.current.id }); } catch {}
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionStatus("Erro de conexão");
          setConnectionError(error?.message || `Status: ${status}`);
        }
      });

    channelRef.current = channel;
    supabaseRef.current = supabase;
    setRoomCode(cleanCode);
    window.localStorage.setItem(ROOM_KEY, cleanCode);
    setSupabaseConfig(config);
    return true;
  }, [applyState, disconnect, sendEvent]);

  useEffect(() => {
    if (!roomCode) return;
    return () => { void disconnect(); };
  }, [roomCode, disconnect]);

  useEffect(() => {
    const saved = stateRef.current;
    if (!saved || !isHost) return;
    const next = cloneState(saved);
    next.players = players;
    stateRef.current = next;
  }, [players, isHost]);

  useEffect(() => {
    if (!rootRef.current) return;
    const scope = createScope({ root: rootRef.current });
    scope.add(() => {
      animate(".anim", { opacity: [0, 1], y: [18, 0], duration: 650, delay: stagger(50), ease: "out(4)" });
      animate(".pop", { opacity: [0, 1], scale: [.94, 1], duration: 520, delay: stagger(45), ease: "out(4)" });
    });
    return () => scope.revert();
  }, [phase, round.number, roomCode]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chaosOverlay?.active) return;
    if (chaosTimeoutRef.current) window.clearTimeout(chaosTimeoutRef.current);
    const remaining = Math.max(1, 15000 - (Date.now() - chaosOverlay.startedAt));
    chaosTimeoutRef.current = window.setTimeout(() => setChaosOverlay(null), remaining);
    return () => {
      if (chaosTimeoutRef.current) window.clearTimeout(chaosTimeoutRef.current);
    };
  }, [chaosOverlay]);

  const submitProfile = () => {
    const name = draftName.trim() || "Jogador";
    const id = profile.id || makePlayerId();
    const next = createPlayerProfile(name, draftAvatar, draftColor, id);
    setProfile(next);
    profileRef.current = next;
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setShowSetup(false);
    setConnectionError("");
  };

  const createRoom = async () => {
    if (!profile.id) return;
    const nextRoom = makeRoomCode();
    hostIdRef.current = profile.id;
    const lobbyState: GameState = {
      phase: "lobby",
      round: defaultRound(profile.id),
      players: [{ ...profile, host: true }],
      result: null,
      chaosUsed: false,
      chaos: null
    };
    stateRef.current = lobbyState;
    applyState(lobbyState);
    const ok = await connectToRoom(nextRoom, "host");
    if (!ok) return;
    try { await sendEvent({ type: "STATE_SYNC", state: lobbyState }); } catch {}
  };

  const joinRoom = async () => {
    const clean = roomInput.trim().toUpperCase();
    if (!clean) return setConnectionError("Digite o código da sala.");
    await connectToRoom(clean, "guest");
  };

  const startMatch = async () => {
    if (!isHost || players.length < 2) return;
    const firstRound = defaultRound(players[0].id);
    firstRound.question = getQuestion(1);
    const state: GameState = {
      phase: "answering",
      round: firstRound,
      players: players.map((player) => ({ ...player, score: 0, host: player.id === hostIdRef.current })),
      result: null,
      chaosUsed: false,
      chaos: null
    };
    secretCorrectRef.current = 0;
    secretVotesRef.current = {};
    stateRef.current = state;
    applyState(state);
    try { await sendEvent({ type: "START_GAME", state }); } catch (error) { setConnectionError(error instanceof Error ? error.message : "Falha ao iniciar."); }
  };

  const prepareSpecialTheme = async (selected: Theme) => {
    if (!isHost || phase !== "special-theme") return;
    try { await sendEvent({ type: "SELECT_THEME", theme: selected, from: profile.id }); } catch (error) { setThemeError(error instanceof Error ? error.message : "Falha ao selecionar tema."); }
  };

  const submitAnswers = async () => {
    if (!isTarget || round.submitted) return;
    if (localAnswers.some((answer) => answer.trim().length < 2)) {
      setConnectionError("Preencha as três respostas. Uma delas deve ser marcada como verdade.");
      return;
    }
    setConnectionError("");
    try {
      await sendEvent({ type: "SUBMIT_ANSWERS", from: profile.id, answers: localAnswers, correctIndex: localCorrect });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Não foi possível entregar as respostas.");
    }
  };

  const castVote = async () => {
    if (phase !== "voting" || isTarget || localVote === null || myVoteDone) return;
    setConnectionError("");
    try {
      await sendEvent({ type: "CAST_VOTE", from: profile.id, answerIndex: localVote });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Não foi possível registrar o voto.");
    }
  };

  const nextRound = async () => {
    if (!isHost) return;
    if (round.number >= 12) {
      const next = cloneState(stateRef.current!);
      next.phase = "finished";
      next.result = result;
      applyState(next);
      try { await sendEvent({ type: "STATE_SYNC", state: next }); } catch {}
      return;
    }

    const number = round.number + 1;
    if (number === 6) {
      const next = cloneState(stateRef.current!);
      next.phase = "special-theme";
      next.round = { ...defaultRound(players[5 % players.length]?.id || players[0].id), number, targetId: players[5 % players.length]?.id || players[0].id, question: "", doublePoints: true, submitted: false, votedIds: [] };
      next.result = null;
      next.chaos = null;
      stateRef.current = next;
      applyState(next);
      try { await sendEvent({ type: "STATE_SYNC", state: next }); } catch {}
      return;
    }

    const targetId = players[(number - 1) % players.length]?.id || players[0]?.id || profile.id;
    const next: GameState = {
      ...(cloneState(stateRef.current!)),
      phase: "answering",
      round: {
        number,
        targetId,
        question: getQuestion(number),
        answers: ["", "", ""],
        doublePoints: false,
        submitted: false,
        votedIds: []
      },
      result: null,
      chaos: null
    };
    secretCorrectRef.current = 0;
    secretVotesRef.current = {};
    stateRef.current = next;
    applyState(next);
    try { await sendEvent({ type: "STATE_SYNC", state: next }); } catch {}
  };

  const useChaos = async () => {
    if (chaosUsed || phase === "finished" || phase === "special-theme") return;
    const returnTo = phase === "voting" ? "voting" : "answering";
    try {
      await sendEvent({ type: "START_CHAOS", from: profile.id, returnTo });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Não foi possível ativar a carta.");
    }
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const message: ChatMessage = {
      id: `${profile.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      playerId: profile.id,
      playerName: profile.name,
      avatar: profile.avatar,
      color: profile.color,
      text,
      createdAt: Date.now()
    };
    setChatInput("");
    try {
      await sendEvent({ type: "CHAT", message });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
    }
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {}
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const myAvatar = avatarById(profile.avatar);
  const targetAvatar = target ? avatarById(target.avatar) : null;

  const saveServerConfig = (url: string, key: string) => {
    const cleanUrl = url.trim().replace(/\/$/, "");
    const cleanKey = key.trim();
    saveSupabaseConfig({ url: cleanUrl, key: cleanKey });
    setSupabaseConfig({ url: cleanUrl, key: cleanKey });
    setShowSetup(false);
    setConnectionError("");
  };

  return (
    <div ref={rootRef} className="app-shell">
      <ThreeBackground intensity={0.8} />
      <div className="noise" />

      <header className="topbar anim">
        <div className="brand">
          <div className="brand-mark">😂</div>
          <div>
            <strong>Mentira Profissional</strong>
            <span>party game · verdades suspeitas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="status-line" style={{ margin: 0 }}>{connectionStatus === "Conectado" ? "● online" : "○ offline"}</span>
          <button className="ghost-button" onClick={() => setShowSetup(true)}>⚙</button>
          <button className="ghost-button" onClick={() => setShowHow(true)}>?</button>
        </div>
      </header>

      {!roomCode && (
        <main className="page">
          <section className="hero anim">
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="eyebrow">🎭 seis jogadores · uma verdade · muito caos</div>
                <h1>MENTIRA<span>PROFISSIONAL</span></h1>
                <p>Crie uma sala, escolha seu personagem e jogue com quem estiver em outro computador ou celular. O alvo inventa duas mentiras. O grupo tenta sobreviver à verdade.</p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => { setShowSetup(true); setDraftName(profile.name); }}>🎮 Meu personagem</button>
                  <button className="secondary" onClick={() => setShowHow(true)}>Como funciona</button>
                </div>
              </div>

              <div className="panel room-card pop">
                <div className="round-label">SUA MÁQUINA · SEU PERSONAGEM</div>
                <div className="character-preview" style={{ marginTop: 12, minHeight: 280 }}>
                  <div className="character-big" style={{ borderColor: `${profile.color}88`, background: `${profile.color}18` }}>{myAvatar.emoji}</div>
                  <strong>{profile.name}</strong>
                  <span>{myAvatar.label} · {profile.id ? "identidade salva neste navegador" : "criando identidade..."}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="setup-grid">
            <div className="panel panel-pad pop">
              <div className="section-title">Criar uma mesa</div>
              <p className="section-subtitle">Abra uma sala e mande o código para quem vai jogar com você.</p>
              <button className="primary" style={{ marginTop: 18 }} onClick={createRoom}>＋ CRIAR SALA</button>
              <div className={`status-line ${connectionStatus === "Conectado" ? "ok" : connectionError ? "error" : ""}`}>{supabaseConfig ? "Servidor configurado" : "Servidor multiplayer ainda não configurado"}</div>
            </div>
            <div className="panel panel-pad pop">
              <div className="section-title">Entrar em uma sala</div>
              <p className="section-subtitle">Digite o código que o criador enviou.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <input className="chat-input mono" value={roomInput} onChange={(event) => setRoomInput(event.target.value.toUpperCase().slice(0, 5))} placeholder="X7KQ2" maxLength={5} />
                <button className="primary" onClick={joinRoom}>ENTRAR</button>
              </div>
            </div>
          </section>
          {connectionError && !roomCode && <div className="status-line error" style={{ marginTop: 12 }}>{connectionError}</div>}
        </main>
      )}

      {roomCode && phase === "lobby" && (
        <main className="page">
          <div className="roundbar anim">
            <div>
              <div className="round-label">SALA ABERTA · 6 LUGARES</div>
              <h1 className="round-title">A mesa está esperando.</h1>
            </div>
            <div className="badge-row"><div className="badge">{players.length}/6 jogadores</div><div className="badge">{connectionStatus}</div></div>
          </div>

          <div className="lobby-layout" style={{ marginTop: 16 }}>
            <section className="panel lobby-main anim">
              <div className="lobby-header">
                <div>
                  <div className="round-label">CÓDIGO DA SALA</div>
                  <div className="room-code">{roomCode}</div>
                  <div className="copy-row"><button className="ghost-button" onClick={copyRoom}>Copiar código</button><code>mande no WhatsApp / Discord / Meet</code></div>
                </div>
                {isHost ? <button className="primary" onClick={startMatch} disabled={players.length < 2}>🎲 COMEÇAR PARTIDA</button> : <div className="badge">Aguardando o host…</div>}
              </div>
              <div className="player-grid">
                {players.map((player) => {
                  const avatar = avatarById(player.avatar);
                  return <div className="player-card pop" key={player.id} style={{ borderColor: player.id === profile.id ? `${player.color}55` : undefined }}>
                    <div className="player-top"><div className="mini-avatar" style={{ background: `${player.color}18`, borderColor: `${player.color}55` }}>{avatar.emoji}</div><div style={{ minWidth: 0 }}><div className="player-name">{player.name}{player.id === profile.id ? " · você" : ""}</div><div className="player-role">{player.id === hostIdRef.current ? "host" : avatar.label}</div></div><span className="ready-dot" title="online" /></div>
                  </div>;
                })}
                {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, index) => <div className="empty-card" key={`empty-${index}`}>LUGAR {players.length + index + 1} · aguardando jogador</div>)}
              </div>
            </section>

            <aside className="panel chat anim">
              <div className="chat-head"><div><strong>💬 Chat da mesa</strong><div className="status-line" style={{ marginTop: 2 }}>todo mundo vê a mesma conversa</div></div></div>
              <div className="chat-log" ref={chatScrollRef}>
                {messages.length === 0 && <div className="empty-card">Escreva a primeira provocação 😂</div>}
                {messages.map((message) => <div className="chat-msg" key={message.id}><div className="chat-avatar" style={{ background: `${message.color}20` }}>{avatarById(message.avatar).emoji}</div><div className="chat-bubble"><strong style={{ color: message.color }}>{message.playerName}{message.playerId === profile.id ? " · você" : ""}</strong><p>{message.text}</p></div></div>)}
              </div>
              <form className="chat-form" onSubmit={sendChat}><input className="chat-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Mande uma fofoca…" maxLength={220} /><button className="primary" type="submit">Enviar</button></form>
            </aside>
          </div>
        </main>
      )}

      {roomCode && phase !== "lobby" && (
        <main className="page">
          <div className="game-layout">
            <div className="game-main">
              <div className="roundbar anim">
                <div>
                  <div className="round-label">MENTIRA PROFISSIONAL · {String(round.number).padStart(2, "0")} / 12</div>
                  <h1 className="round-title">{phase === "special-theme" ? "Escolham o caos." : phase === "reveal" ? "Hora da verdade." : phase === "finished" ? "O tribunal decidiu." : `${target?.name ?? "Alguém"} está no banco dos réus.`}</h1>
                </div>
                <div className="badge-row">{round.doublePoints && <div className="badge special">⚡ 2× pontos</div>}{round.theme && <div className="badge">{round.theme}</div>}</div>
              </div>

              {phase === "special-theme" && (
                <section className="panel special anim">
                  <div className="eyebrow">RODADA 06 · ESPECIAL</div>
                  <h2 className="section-title" style={{ marginTop: 8 }}>Escolham um tema.</h2>
                  <p className="section-subtitle">O primeiro tema escolhido pelo host prepara a pergunta e deixa essa rodada valendo pontos dobrados.</p>
                  <div className="theme-grid">
                    {themes.map((item) => <button className="theme-button" key={item} onClick={() => prepareSpecialTheme(item)} disabled={!isHost}><span>{({ Escola: "📚", Trabalho: "💼", Família: "🏠", Viagem: "✈️", Internet: "🌐", "Primeiros encontros": "💘" } as Record<Theme, string>)[item]}</span><strong>{item}</strong><small>{isHost ? "escolher tema" : "host escolhe"}</small></button>)}
                  </div>
                  {themeError && <div className="status-line error">{themeError}</div>}
                </section>
              )}

              {phase === "answering" && target && (
                <>
                  <section className="panel question-card anim">
                    <div className="question-symbol">🎯</div>
                    <div className="eyebrow" style={{ marginTop: 13 }}>ALVO · {target.name}</div>
                    <h2>{round.question}</h2>
                    <p className="helper">{isTarget ? "É sua vez. Só você vê estas respostas enquanto escreve." : `Passe o dispositivo para ${target.name}. O alvo está respondendo agora.`}</p>
                  </section>

                  {isTarget ? (
                    <section className="panel answer-editor anim">
                      <div className="roundbar">
                        <div><div className="round-label">SEU TRABALHO · MENTIR COM CONVICÇÃO</div><h2 className="section-title">Escreva 3 respostas</h2></div>
                        {!chaosUsed && <button className="danger-button" onClick={useChaos}>🎬 Carta Caótica</button>}
                      </div>
                      <div className="answer-grid">
                        {localAnswers.map((answer, index) => <div className="answer-row pop" key={letters[index]}><div className="answer-letter">{letters[index]}</div><input value={answer} onChange={(event) => setLocalAnswers((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder={`Resposta ${letters[index]}`} maxLength={140} disabled={round.submitted} /><button className={`correct-toggle ${localCorrect === index ? "selected" : ""}`} onClick={() => setLocalCorrect(index)} disabled={round.submitted}>{localCorrect === index ? "✓ VERDADE" : "Marcar verdade"}</button></div>)}
                      </div>
                      <div className="editor-actions"><span className="status-line" style={{ margin: 0 }}>Uma resposta é verdadeira. As outras duas precisam ser convincentes.</span><button className="primary" onClick={submitAnswers} disabled={round.submitted}>{round.submitted ? "✓ ENTREGUE" : "ENTREGAR AO GRUPO →"}</button></div>
                    </section>
                  ) : (
                    <section className="panel panel-pad anim"><div className="eyebrow">AGUARDE O ALVO</div><h2 className="section-title" style={{ marginTop: 9 }}>Quando {target.name} entregar, a votação aparece aqui.</h2><div className="status-line">Você pode usar o chat para provocar o alvo enquanto isso.</div></section>
                  )}
                </>
              )}

              {phase === "voting" && (
                <section className="panel panel-pad anim">
                  <div className="roundbar">
                    <div><div className="round-label">VOTAÇÃO · {round.votedIds.length} / {Math.max(0, players.length - 1)}</div><h2 className="section-title">{isTarget ? "Você já entregou. Agora assista às acusações." : `${profile.name}, qual é a verdadeira?`}</h2></div>{!chaosUsed && <button className="danger-button" onClick={useChaos}>🎬 Carta Caótica</button>}</div>
                  <div className="vote-progress">{Array.from({ length: Math.max(0, players.length - 1) }).map((_, index) => <i className={index < round.votedIds.length ? "on" : ""} key={index} />)}</div>
                  {!isTarget && !myVoteDone && <div className="vote-grid">{round.answers.map((answer, index) => <button className={`vote-card pop ${localVote === index ? "selected" : ""}`} key={index} onClick={() => setLocalVote(index)}><div className="vote-index">{letters[index]}</div><p>{answer}</p></button>)}</div>}
                  {isTarget && <div className="panel-pad" style={{ padding: "22px 0 0" }}><div className="status-line">Seu voto não existe nesta rodada porque você é o alvo. Espere o resto do grupo terminar.</div></div>}
                  {myVoteDone && !isTarget && <div className="panel-pad" style={{ padding: "22px 0 0" }}><div className="status-line ok">✓ Seu voto foi registrado e ficou escondido dos outros jogadores.</div></div>}
                  {!isTarget && !myVoteDone && <div className="vote-foot"><span className="status-line" style={{ margin: 0 }}>Seu voto não aparece para os próximos.</span><button className="primary" onClick={castVote} disabled={localVote === null}>CONFIRMAR VOTO</button></div>}
                </section>
              )}

              {phase === "reveal" && result && target && (
                <section className="panel reveal anim">
                  <div className="reveal-state">ARQUIVO CONFIDENCIAL ABERTO</div>
                  <h2>{result.winners.length ? "Pegaram a mentira. 👀" : "Ninguém caiu nessa. 😂"}</h2>
                  <div className="reveal-answer"><strong>{letters[result.correctAnswer]} era verdade:</strong> {round.answers[result.correctAnswer]}</div>
                  {result.winners.length ? <div className="reveal-list">{result.winners.map((id) => { const winner = players.find((player) => player.id === id); return winner ? <span className="reveal-chip" key={id}>+{result.winnerPoints} · {winner.name}</span> : null; })}</div> : <div className="reveal-points">🎯 {target.name} ganhou +{result.targetPoints} por mentir profissionalmente.</div>}
                  {isHost ? <div style={{ marginTop: 22 }}><button className="primary" onClick={nextRound}>{round.number >= 12 ? "VER RESULTADO FINAL" : "PRÓXIMA RODADA →"}</button></div> : <div className="status-line" style={{ marginTop: 22 }}>O host vai avançar a mesa quando todo mundo comentar o resultado.</div>}
                </section>
              )}

              {phase === "finished" && (
                <section className="panel finished anim">
                  <div className="eyebrow">12 / 12 · FIM DA PARTIDA</div>
                  <h2 style={{ margin: "14px 0 0", fontSize: "clamp(42px,7vw,78px)", lineHeight: .9, letterSpacing: "-.07em" }}>A verdade venceu.<br /><span style={{ color: "var(--cyan)" }}>Por pouco.</span></h2>
                  <p className="section-subtitle">Agora é a parte em que todo mundo explica por que “óbvio que era a B”.</p>
                  <div className="final-list">{sortedPlayers.map((player, index) => <div className="final-line" key={player.id}><span>{index === 0 ? "🏆 " : `${index + 1}º · `}{player.name}</span><strong>{player.score} pts</strong></div>)}</div>
                  <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>{isHost && <button className="primary" onClick={() => { hostIdRef.current = profile.id; void startMatch(); }}>JOGAR NOVAMENTE</button>}<button className="secondary" onClick={() => navigator.clipboard?.writeText(`Mentira Profissional · ${sortedPlayers[0]?.name ?? "vencedor"} terminou com ${sortedPlayers[0]?.score ?? 0} pontos.`)}>COPIAR RESULTADO</button></div>
                </section>
              )}
            </div>

            <aside className="sidebar-stack">
              <section className="panel score-card anim"><h3>🏆 Placar</h3>{sortedPlayers.map((player) => <div className={`score-row ${player.id === round.targetId ? "current" : ""}`} key={player.id}><span className="score-name">{player.id === round.targetId ? "🎯 " : ""}{player.name}</span><span className="score-value">{player.score}</span></div>)}</section>
              <section className="panel chat anim"><div className="chat-head"><strong>💬 Chat</strong><span className="status-line" style={{ margin: 0 }}>{messages.length}</span></div><div className="chat-log" ref={chatScrollRef}>{messages.map((message) => <div className="chat-msg" key={message.id}><div className="chat-avatar" style={{ background: `${message.color}20` }}>{avatarById(message.avatar).emoji}</div><div className="chat-bubble"><strong style={{ color: message.color }}>{message.playerName}{message.playerId === profile.id ? " · você" : ""}</strong><p>{message.text}</p></div></div>)}</div><form className="chat-form" onSubmit={sendChat}><input className="chat-input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Provoque alguém…" maxLength={220} /><button className="primary" type="submit">↑</button></form></section>
            </aside>
          </div>
        </main>
      )}

      {connectionError && roomCode && <div style={{ position: "fixed", left: 14, bottom: 14, zIndex: 40, maxWidth: "min(560px, calc(100% - 28px))" }}><div className="panel panel-pad" style={{ borderColor: "rgba(255,92,168,.3)" }}><div className="status-line error" style={{ margin: 0 }}>{connectionError}</div></div></div>}

      {showSetup && (
        <div className="chaos-modal" onMouseDown={() => setShowSetup(false)}>
          <div className="panel panel-pad" style={{ width: "min(760px,100%)" }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="roundbar"><div><div className="round-label">SEU PERSONAGEM</div><h2 className="section-title">Quem é você na mesa?</h2></div><button className="ghost-button" onClick={() => setShowSetup(false)}>Fechar</button></div>
            <div className="setup-grid" style={{ marginTop: 16 }}>
              <div>
                <div className="field"><label>Nome</label><input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={24} placeholder="Pedro" /></div>
                <div className="field" style={{ marginTop: 14 }}><label>Avatar</label><div className="avatar-grid">{AVATARS.map((avatar) => <button className={`avatar-btn ${draftAvatar === avatar.id ? "active" : ""}`} key={avatar.id} onClick={() => setDraftAvatar(avatar.id)}>{avatar.emoji}</button>)}</div></div>
                <div className="field" style={{ marginTop: 14 }}><label>Cor</label><div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>{COLORS.map((color) => <button key={color} onClick={() => setDraftColor(color)} style={{ width: 34, height: 34, borderRadius: 10, background: color, border: draftColor === color ? "3px solid white" : "1px solid rgba(255,255,255,.15)", cursor: "pointer" }} />)}</div></div>
                <button className="primary" style={{ marginTop: 18 }} onClick={submitProfile}>SALVAR PERSONAGEM</button>
              </div>
              <div className="character-preview"><div className="character-big" style={{ borderColor: `${draftColor}88`, background: `${draftColor}18` }}>{avatarById(draftAvatar).emoji}</div><strong>{draftName.trim() || "Jogador"}</strong><span>Este personagem fica salvo neste navegador. Outro computador terá sua própria identidade.</span></div>
            </div>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0" }} />
            <div className="round-label">MULTIPLAYER · SUPABASE REALTIME</div>
            <p className="section-subtitle">O GitHub Pages hospeda o site; o Supabase faz a comunicação em tempo real entre os computadores.</p>
            <ServerConfig formConfig={supabaseConfig} onSave={saveServerConfig} />
          </div>
        </div>
      )}

      {showHow && (
        <div className="chaos-modal" onMouseDown={() => setShowHow(false)}>
          <div className="panel panel-pad" style={{ width: "min(760px,100%)" }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="roundbar"><div><div className="round-label">COMO JOGAR</div><h2 className="section-title">Aqui, falar a verdade é suspeito.</h2></div><button className="ghost-button" onClick={() => setShowHow(false)}>Fechar</button></div>
            <div className="rules" style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <div className="panel panel-pad"><strong>01 · Alvo</strong><div className="status-line">O alvo responde com três frases. Uma é verdade; duas são inventadas.</div></div>
              <div className="panel panel-pad"><strong>02 · Votação</strong><div className="status-line">Os outros jogadores votam escondido. Cada acerto vale 1 ponto.</div></div>
              <div className="panel panel-pad"><strong>03 · Rodada especial</strong><div className="status-line">A rodada 6 escolhe um tema e vale pontos dobrados.</div></div>
              <div className="panel panel-pad"><strong>04 · Carta Caótica</strong><div className="status-line">Uma vez na partida, alguém ativa “Conte igual a um narrador de filme” por 15 segundos.</div></div>
            </div>
          </div>
        </div>
      )}

      {chaosOverlay?.active && (
        <div className="chaos-modal">
          <div className="chaos-box anim">
            <div className="big">🎬</div>
            <div className="eyebrow">DESAFIO CAÓTICO · {players.find((player) => player.id === chaosOverlay.by)?.name ?? "alguém"}</div>
            <h2 className="section-title" style={{ marginTop: 10 }}>Conte igual a um narrador de filme.</h2>
            <p className="section-subtitle">Agora tudo precisa soar como o final de uma trilogia.</p>
            <div className="timer">00:15</div>
            <div className="mono" style={{ color: "#ffb5d6", fontSize: 12 }}>“NAQUELA NOITE... ELE AINDA NÃO SABIA.”</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerConfig({ formConfig, onSave }: { formConfig: SupabaseConfig | null; onSave: (url: string, key: string) => void }) {
  const [url, setUrl] = useState(formConfig?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const [key, setKey] = useState(formConfig?.key ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");

  useEffect(() => {
    setUrl(formConfig?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    setKey(formConfig?.key ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
  }, [formConfig]);

  return (
    <div className="field-grid" style={{ gridTemplateColumns: "1fr" }}>
      <div className="field"><label>Supabase Project URL</label><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://xxxxx.supabase.co" /></div>
      <div className="field"><label>Publishable key</label><input value={key} onChange={(event) => setKey(event.target.value)} placeholder="sb_publishable_..." /></div>
      <button className="secondary" onClick={() => onSave(url, key)} disabled={!url.trim() || !key.trim()}>Salvar conexão multiplayer</button>
    </div>
  );
}
