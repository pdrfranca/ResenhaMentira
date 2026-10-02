"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, createScope } from "animejs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import ThreeBackground from "@/components/three-background";
import { getSupabase } from "@/lib/supabase";
import { THEMES } from "@/lib/questions";
import { allVoters, makeInitialState, startNextRound } from "@/lib/game";
import type { AvatarId, GameState, Player, WireMessage } from "@/types/game";

type ChatMessage = { id: string; playerId: string; text: string };

type AvatarInfo = { icon: string; label: string };

const AVATARS: Record<AvatarId, AvatarInfo> = {
  cat: { icon: "😼", label: "Gato suspeito" },
  alien: { icon: "👽", label: "Alien mentiroso" },
  wizard: { icon: "🧙", label: "Mago dramático" },
  toast: { icon: "🍞", label: "Pão tostado" },
  ghost: { icon: "👻", label: "Fantasma online" },
  frog: { icon: "🐸", label: "Sapo desconfiado" },
};

const ACCENTS = ["#ff5c6c", "#6e7dff", "#55d6be", "#ffb454", "#b86cff", "#55b7ff"];
const PLAYER_KEY = "mentira-profissional-player";

function uid(prefix = "p") {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function savePlayer(player: Player) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

function loadPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? (JSON.parse(raw) as Player) : null;
  } catch {
    return null;
  }
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function Home() {
  const supabase = getSupabase();
  const [me, setMe] = useState<Player | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("cat");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<GameState>(makeInitialState());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [answers, setAnswers] = useState(["", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [theme, setTheme] = useState<string>(THEMES[0]);
  const [status, setStatus] = useState("Pronto para mentir");
  const [notice, setNotice] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerRef = useRef<Player | null>(null);
  const gameRef = useRef(game);
  const playersRef = useRef(players);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null);

  const configured = Boolean(supabase);

  useEffect(() => {
    const stored = loadPlayer();
    if (stored) {
      setMe(stored);
      playerRef.current = stored;
      setName(stored.name);
      setAvatar(stored.avatar);
      setAccent(stored.accent);
    }
    scopeRef.current = createScope({ root: document });
    return () => scopeRef.current?.revert();
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const animateIn = (targets: string | Element) => {
    const result = animate(targets, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.98, 1],
      duration: 520,
      ease: "out(4)",
    });
    return result;
  };

  const broadcast = async (message: WireMessage) => {
    await channelRef.current?.send({ type: "broadcast", event: "game", payload: message });
  };

  const updatePresencePlayers = () => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<{ player: Player }>();
    const next = Object.values(state)
      .flat()
      .map((x) => x.player)
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id));
    setPlayers(next);
    playersRef.current = next;
  };

  const connectRoom = async (code: string, host: boolean) => {
    if (!supabase || !me) return;
    channelRef.current?.unsubscribe();
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    setRoomCode(normalized);
    setIsHost(host);
    setStatus("Conectando à mesa...");

    const channel = supabase.channel(`room:${normalized}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => updatePresencePlayers())
      .on("presence", { event: "join" }, () => updatePresencePlayers())
      .on("presence", { event: "leave" }, () => updatePresencePlayers())
      .on("broadcast", { event: "game" }, ({ payload }: { payload: WireMessage }) => {
        handleWire(payload);
      })
      .subscribe(async (subStatus) => {
        if (subStatus !== "SUBSCRIBED") return;
        await channel.track({ player: me });
        setStatus(host ? "Você é o dono da mesa" : "Você entrou na mesa");
        updatePresencePlayers();
        await broadcast({ type: "hello", player: me });
        if (!host) await broadcast({ type: "request_state", playerId: me.id });
        if (host) {
          const initial = makeInitialState();
          setGame(initial);
          gameRef.current = initial;
          await broadcast({ type: "state", state: initial, players: playersRef.current });
        }
        animateIn(".game-shell");
      });
  };

  const handleWire = async (message: WireMessage) => {
    if (!me) return;
    if (message.type === "hello") {
      setPlayers((current) => {
        const found = current.some((p) => p.id === message.player.id);
        return found ? current.map((p) => (p.id === message.player.id ? message.player : p)) : [...current, message.player];
      });
      if (isHost && gameRef.current.phase !== "lobby") {
        await broadcast({ type: "state", state: gameRef.current, players: playersRef.current });
      }
      return;
    }

    if (message.type === "request_state" && isHost) {
      await broadcast({ type: "state", state: gameRef.current, players: playersRef.current });
      return;
    }

    if (message.type === "state") {
      setGame(message.state);
      gameRef.current = message.state;
      if (message.players?.length) setPlayers(message.players);
      window.setTimeout(() => animateIn(".state-card"), 20);
      return;
    }

    if (message.type === "set_ready") {
      setPlayers((current) => current.map((p) => (p.id === message.playerId ? { ...p, ready: message.ready } : p)));
      return;
    }

    if (message.type === "start_game") {
      setGame(message.state);
      gameRef.current = message.state;
      return;
    }

    if (message.type === "submit_answers" && isHost) {
      const current = gameRef.current;
      const next = { ...current, phase: "voting" as const, answers: shuffle(message.answers), correctIndex: message.answers.indexOf(message.answers[message.correctIndex]) };
      // Preserve the relationship after shuffle.
      const correctText = message.answers[message.correctIndex];
      next.correctIndex = next.answers.indexOf(correctText);
      setGame(next);
      gameRef.current = next;
      await broadcast({ type: "state", state: next, players: playersRef.current });
      return;
    }

    if (message.type === "vote" && isHost) {
      const current = gameRef.current;
      const nextVotes = { ...current.votes, [message.playerId]: message.answerIndex };
      const voters = allVoters(playersRef.current, current.targetId);
      const done = [...current.votingDone, message.playerId].filter((id, index, arr) => arr.indexOf(id) === index);
      const next = { ...current, votes: nextVotes, votingDone: done };
      if (done.length >= voters.length && voters.length > 0) {
        const counts = [0, 0, 0];
        Object.values(nextVotes).forEach((i) => { counts[i] += 1; });
        const winners = counts.map((count, i) => ({ count, i })).sort((a, b) => b.count - a.count);
        const votedAnswer = winners[0].i;
        const correct = next.correctIndex ?? -1;
        const updatedPlayers = playersRef.current.map((p) => {
          if (p.id === correct) return p;
          const gain = next.doublePoints ? 2 : 1;
          const gotRight = nextVotes[p.id] === correct;
          return gotRight ? { ...p, score: p.score + gain } : p;
        });
        const target = playersRef.current.find((p) => p.id === next.targetId);
        const correctCount = Object.values(nextVotes).filter((i) => i === correct).length;
        const targetBonus = correctCount === 0 && target ? 3 : 0;
        const finalPlayers = updatedPlayers.map((p) => p.id === target?.id ? { ...p, score: p.score + targetBonus } : p);
        setPlayers(finalPlayers);
        playersRef.current = finalPlayers;
        const result: GameState = {
          ...next,
          phase: "reveal",
          lastResult: {
            winnerText: correctCount === 0 ? `${target?.name ?? "O alvo"} enganou a mesa inteira!` : `${correctCount} jogador(es) descobriram a verdade.`,
            answerIndex: votedAnswer,
          },
        };
        setGame(result);
        gameRef.current = result;
        await broadcast({ type: "state", state: result, players: finalPlayers });
        return;
      }
      setGame(next);
      gameRef.current = next;
      await broadcast({ type: "state", state: next, players: playersRef.current });
      return;
    }

    if (message.type === "use_chaos") {
      const next = { ...gameRef.current, chaosUsed: true, chaosBy: message.playerId };
      setGame(next);
      gameRef.current = next;
      if (isHost) await broadcast({ type: "state", state: next, players: playersRef.current });
      return;
    }

    if (message.type === "chat") {
      setChat((c) => [...c.slice(-80), { id: uid("m"), playerId: message.playerId, text: message.text }]);
    }
  };

  const saveMe = () => {
    const player: Player = { id: me?.id ?? uid(), name: name.trim().slice(0, 18) || "Jogador", avatar, accent, host: me?.host, score: me?.score ?? 0, ready: false, online: true };
    savePlayer(player);
    setMe(player);
    playerRef.current = player;
    return player;
  };

  const createRoom = async () => {
    if (!configured) {
      setNotice("Configure o Supabase no GitHub antes de criar salas.");
      return;
    }
    const player = saveMe();
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    player.host = true;
    savePlayer(player);
    setMe(player);
    playerRef.current = player;
    await connectRoom(code, true);
  };

  const joinRoom = async () => {
    if (!configured) {
      setNotice("Configure o Supabase no GitHub antes de entrar em salas.");
      return;
    }
    const code = roomInput.trim().toUpperCase();
    if (code.length !== 5) {
      setNotice("O código da sala tem 5 caracteres.");
      return;
    }
    const player = saveMe();
    player.host = false;
    savePlayer(player);
    setMe(player);
    playerRef.current = player;
    await connectRoom(code, false);
  };

  const setReady = async () => {
    if (!me || !channelRef.current) return;
    const ready = !me.ready;
    const next = { ...me, ready };
    setMe(next);
    playerRef.current = next;
    savePlayer(next);
    await channelRef.current.track({ player: next });
    await broadcast({ type: "set_ready", playerId: me.id, ready });
  };

  const startGame = async () => {
    if (!isHost || !me || players.length < 2) return;
    const next = startNextRound(gameRef.current, playersRef.current);
    setGame(next);
    gameRef.current = next;
    await broadcast({ type: "start_game", state: next });
    await broadcast({ type: "state", state: next, players: playersRef.current });
  };

  const submitAnswers = async () => {
    if (!me || !game.targetId || me.id !== game.targetId || answers.some((a) => !a.trim())) return;
    await broadcast({ type: "submit_answers", playerId: me.id, answers: answers.map((a) => a.trim()), correctIndex });
    setStatus("Mentira enviada. Agora observe o caos.");
  };

  const vote = async (index: number) => {
    if (!me || me.id === game.targetId || game.votingDone.includes(me.id)) return;
    setSelectedVote(index);
    await broadcast({ type: "vote", playerId: me.id, answerIndex: index });
  };

  const useChaos = async () => {
    if (!me || game.chaosUsed) return;
    await broadcast({ type: "use_chaos", playerId: me.id });
    setNotice("🎬 Desafio Caótico ativado! Hora de narrar como trailer de cinema.");
  };

  const chooseThemeAndContinue = async () => {
    if (!isHost) return;
    const next = startNextRound({ ...gameRef.current, theme, specialChosen: true }, playersRef.current, theme);
    next.doublePoints = true;
    setGame(next);
    gameRef.current = next;
    await broadcast({ type: "state", state: next, players: playersRef.current });
  };

  const nextRound = async () => {
    if (!isHost) return;
    if (game.round >= game.totalRounds) {
      const final = { ...gameRef.current, phase: "finished" as const };
      setGame(final);
      gameRef.current = final;
      await broadcast({ type: "state", state: final, players: playersRef.current });
      return;
    }
    const next = startNextRound(gameRef.current, playersRef.current);
    setAnswers(["", "", ""]);
    setSelectedVote(null);
    setCorrectIndex(0);
    setGame(next);
    gameRef.current = next;
    await broadcast({ type: "state", state: next, players: playersRef.current });
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || !me) return;
    await broadcast({ type: "chat", playerId: me.id, text: text.slice(0, 120) });
    setChatText("");
  };

  const target = useMemo(() => players.find((p) => p.id === game.targetId), [players, game.targetId]);
  const winner = useMemo(() => [...players].sort((a, b) => b.score - a.score)[0], [players]);

  if (!configured) {
    return (
      <main className="site-shell">
        <ThreeBackground />
        <div className="setup-screen">
          <div className="logo-badge">MP</div>
          <p className="eyebrow">PARTY GAME · ONLINE</p>
          <h1>Mentira <span>Profissional</span></h1>
          <p className="setup-copy">O visual está pronto. Para o multiplayer funcionar no GitHub Pages, conecte este site a um projeto Supabase.</p>
          <div className="setup-card">
            <strong>Falta só a conexão online</strong>
            <p>Adicione no GitHub os secrets <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. O site continuará hospedado no GitHub Pages; o Supabase fará a comunicação em tempo real.</p>
          </div>
          <div className="setup-steps"><span>01</span> Criar Supabase <span>02</span> Colar as chaves <span>03</span> Push no GitHub</div>
        </div>
      </main>
    );
  }

  if (!me || !roomCode) {
    return (
      <main className="site-shell menu-shell">
        <ThreeBackground />
        <header className="brand-row"><div className="logo-mark">🎭</div><div><div className="brand-title">MENTIRA <b>PROFISSIONAL</b></div><div className="brand-sub">a verdade é opcional.</div></div></header>
        <section className="hero-menu">
          <div className="hero-copy">
            <p className="eyebrow">O PARTY GAME DOS CONTADORES DE HISTÓRIA</p>
            <h1>MENTIRA<br /><span>PROFISSIONAL</span></h1>
            <p>Seis jogadores. Três respostas. Uma verdade. E um monte de gente tentando descobrir quem está inventando.</p>
            <div className="hero-actions">
              <button className="big-button red" onClick={createRoom}>CRIAR MESA <span>→</span></button>
              <div className="join-box"><input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} maxLength={5} placeholder="CÓDIGO" /><button onClick={joinRoom}>ENTRAR</button></div>
            </div>
          </div>
          <div className="character-stage">
            <div className="stage-note note-a">😂 <b>MENTIRA?</b></div>
            <div className="main-character"><div className="character-aura" /><div className="character-face">{AVATARS[avatar].icon}</div><div className="character-body">MENTIROSO</div></div>
            <div className="orbit-card card-1">✦</div><div className="orbit-card card-2">?</div><div className="orbit-card card-3">!</div>
          </div>
        </section>
        <section className="rules-strip"><div><b>12</b><span>RODADAS</span></div><div><b>6</b><span>JOGADORES</span></div><div><b>2×</b><span>RODADA ESPECIAL</span></div><div><b>∞</b><span>VERGONHA</span></div></section>
        <section className="create-panel">
          <div><p className="eyebrow">SEU PERSONAGEM</p><h2>Entre na mesa com uma identidade.</h2></div>
          <div className="character-editor"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" maxLength={18} /><div className="avatar-row">{(Object.keys(AVATARS) as AvatarId[]).map((id, i) => <button key={id} className={avatar === id ? "avatar-choice active" : "avatar-choice"} style={{ borderColor: avatar === id ? ACCENTS[i] : undefined }} onClick={() => { setAvatar(id); setAccent(ACCENTS[i]); }}>{AVATARS[id].icon}</button>)}</div></div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell game-shell">
      <ThreeBackground />
      <header className="game-topbar">
        <div className="brand-title">MENTIRA <b>PROFISSIONAL</b></div>
        <div className="room-pill"><span>MESA</span><strong>{roomCode}</strong><button onClick={() => navigator.clipboard?.writeText(roomCode)}>COPIAR</button></div>
        <div className="me-pill"><span className="mini-avatar">{AVATARS[me.avatar].icon}</span><strong>{me.name}</strong><small>{me.score} pts</small></div>
      </header>

      <section className="table-layout">
        <aside className="player-rail">
          <div className="rail-head"><span>JOGADORES</span><b>{players.length}/6</b></div>
          <div className="player-list">{players.map((p) => <div key={p.id} className={`player-chip ${p.id === game.targetId ? "target" : ""}`} style={{ "--accent": p.accent } as React.CSSProperties}><div className="player-avatar">{AVATARS[p.avatar].icon}</div><div className="player-meta"><strong>{p.name}{p.host ? " ★" : ""}</strong><span>{p.score} pts · {p.id === game.targetId ? "ALVO" : p.ready ? "PRONTO" : "online"}</span></div></div>)}</div>
          <button className="ready-button" onClick={setReady}>{me.ready ? "✓ PRONTO" : "MARCAR COMO PRONTO"}</button>
        </aside>

        <section className="board-area">
          <div className="board-card state-card">
            <div className="board-decor dec-left">✦</div><div className="board-decor dec-right">✦</div>
            {game.phase === "lobby" && <div className="lobby-state"><p className="eyebrow">MESA {roomCode}</p><h1>Chame a turma.</h1><p>Compartilhe o código. Cada computador ganha seu próprio personagem e entra na mesma mesa em tempo real.</p><div className="code-big">{roomCode}</div>{isHost ? <button className="big-button red" onClick={startGame}>COMEÇAR A PARTIDA →</button> : <div className="waiting">⏳ Aguardando o dono da mesa começar...</div>}</div>}

            {game.phase === "answering" && target?.id === me.id && <div className="answer-state"><div className="round-badge">RODADA {game.round}/{game.totalRounds}{game.doublePoints ? " · 2×" : ""}</div><p className="eyebrow">VOCÊ É O ALVO</p><h2>{game.question}</h2>{game.doublePoints && <div className="theme-card"><span>TEMA DA RODADA</span><strong>{game.theme}</strong></div>}<p className="help">Escreva 3 respostas. Uma é verdadeira. Depois embaralhamos tudo para a mesa.</p><div className="answer-form">{answers.map((value, i) => <div key={i} className="answer-input"><span>{String.fromCharCode(65 + i)}</span><input value={value} onChange={(e) => setAnswers((a) => a.map((v, idx) => idx === i ? e.target.value : v))} placeholder={i === 0 ? "Pode ser a história real..." : "Agora inventa bonito."} /></div>)}</div><div className="answer-tools"><label>Qual é a verdadeira?</label><div className="correct-pick">{[0, 1, 2].map((i) => <button key={i} className={correctIndex === i ? "picked" : ""} onClick={() => setCorrectIndex(i)}>{String.fromCharCode(65 + i)}</button>)}</div><button className="chaos-button" disabled={game.chaosUsed} onClick={useChaos}>🎬 {game.chaosUsed ? "DESAFIO USADO" : "ATIVAR DESAFIO CAÓTICO"}</button><button className="big-button red" onClick={submitAnswers}>ENVIAR MINHAS MENTIRAS →</button></div></div>}

            {game.phase === "answering" && target?.id !== me.id && <div className="spectator-state"><div className="round-badge">RODADA {game.round}/{game.totalRounds}{game.doublePoints ? " · PONTOS DOBRADOS" : ""}</div><div className="target-big">{AVATARS[target?.avatar ?? "cat"].icon}</div><p className="eyebrow">ALVO DA VEZ</p><h2>{target?.name}</h2><div className="question-hero">{game.question}</div>{game.doublePoints && <div className="theme-card"><span>TEMA</span><strong>{game.theme}</strong></div>}<div className="waiting">🎭 {target?.name} está preparando três histórias...</div></div>}

            {game.phase === "voting" && <div className="vote-state"><div className="round-badge">ESCOLHA A VERDADE</div><p className="eyebrow">ALVO: {target?.name}</p><h2>{game.question}</h2><div className="vote-grid">{game.answers.map((a, i) => <button key={i} className={`vote-card ${selectedVote === i ? "selected" : ""}`} onClick={() => vote(i)} disabled={me.id === game.targetId || game.votingDone.includes(me.id)}><span>{String.fromCharCode(65 + i)}</span><strong>{a}</strong><em>{me.id === game.targetId ? "VOCÊ ESCREVEU" : game.votingDone.includes(me.id) ? "VOTO ENVIADO" : "VOTAR NESTA"}</em></button>)}</div><div className="vote-progress">{game.votingDone.filter((x) => x !== game.targetId).length}/{Math.max(players.length - 1, 1)} votos recebidos</div></div>}

            {game.phase === "reveal" && <div className="reveal-state"><div className="round-badge">HORA DA VERDADE</div><div className="reveal-stamp">VERDADE</div><p className="eyebrow">A RESPOSTA REAL ERA</p><div className="true-answer">{game.answers[game.correctIndex ?? 0]}</div><p className="result-text">{game.lastResult?.winnerText}</p><div className="reveal-actions">{game.doublePoints && <span className="double-pill">⚡ PONTOS DOBRADOS</span>}{isHost && <button className="big-button red" onClick={game.round >= game.totalRounds ? nextRound : (game.round === 5 && !game.specialChosen ? () => {} : nextRound)}>{game.round >= game.totalRounds ? "VER RESULTADO →" : "PRÓXIMA RODADA →"}</button>}</div>{isHost && game.round === 5 && !game.specialChosen && <div className="special-picker"><p className="eyebrow">RODADA ESPECIAL A SEGUIR</p><h3>Escolham um tema</h3><div className="theme-grid">{THEMES.map((t) => <button className={theme === t ? "theme-choice chosen" : "theme-choice"} onClick={() => setTheme(t)} key={t}>{t}</button>)}</div><button className="big-button yellow" onClick={chooseThemeAndContinue}>ATIVAR 2×</button></div>}</div>}

            {game.phase === "finished" && <div className="finish-state"><p className="eyebrow">PARTIDA ENCERRADA</p><h1>🏆 {winner?.name ?? "A mesa"}</h1><p>sobreviveu às 12 rodadas.</p><div className="final-ranking">{[...players].sort((a, b) => b.score - a.score).map((p, i) => <div key={p.id}><span>#{i + 1}</span><b>{AVATARS[p.avatar].icon} {p.name}</b><strong>{p.score} pts</strong></div>)}</div>{isHost && <button className="big-button red" onClick={() => { const fresh = makeInitialState(); setGame(fresh); gameRef.current = fresh; broadcast({ type: "state", state: fresh, players: playersRef.current }); }}>NOVA PARTIDA</button>}</div>}
          </div>
        </section>

        <aside className="chat-panel">
          <div className="chat-head"><span>CHAT DA MESA</span><b>LIVE</b></div>
          <div className="chat-messages">{chat.length === 0 && <div className="chat-empty">Fale alguma coisa. De preferência, uma mentira.</div>}{chat.map((m) => { const author = players.find((p) => p.id === m.playerId); return <div className="chat-line" key={m.id}><span style={{ color: author?.accent }}>{author?.name ?? "Jogador"}</span><p>{m.text}</p></div>; })}<div ref={chatEndRef} /></div>
          <div className="chat-input"><input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Solte a fofoca..." maxLength={120} /><button onClick={sendChat}>↗</button></div>
          <div className="status-line">● {status}</div>
        </aside>
      </section>
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
