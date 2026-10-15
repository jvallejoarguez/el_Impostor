import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'
import { ClueHistory } from './clue-history.jsx'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { wordCategoriesLabel } from '../wordCategories.js'

// components/screens-game.jsx — role reveal and the turn-by-turn clue round

const ROUND_REVIEW_SECONDS = 4;

// === ROLE REVEAL ===
// Server drives the phase transition via alarm.
function RoleRevealScreen({ myRole, timerEnd }) {
  const remaining = useServerCountdown(timerEnd, 6);
  React.useEffect(() => {
    if (myRole) play(myRole.isImpostor ? 'roleImpostor' : 'roleCrewmate');
  }, [myRole]);

  if (!myRole) return <main className="connection-screen"><p role="status">Recuperando tu rol…</p></main>;

  const isImposter = myRole.isImpostor;
  const revealText = isImposter ? "IMPOSTOR" : (myRole.word ?? "").toUpperCase();
  const longest = Math.max(...revealText.split(/\s+/).map(segment => segment.length), 1);
  const wordSize = `min(24vw, ${(116 / longest).toFixed(2)}vw, 190px)`;

  return (
    <div className={`reveal ${isImposter ? "is-impostor shake" : "is-crew"}`}>
      <div className="reveal-rays" aria-hidden="true"/>
      <div className="reveal-kicker pop">{isImposter ? "Eres el" : "Tu palabra es"}</div>
      <div className="reveal-word slam" style={{ fontSize: wordSize }}>{revealText}</div>
      <div className="slide-up" style={{ animationDelay: ".5s" }}>
        {isImposter
          ? <div className="reveal-hint"><span>Tu pista</span><strong>{myRole.hint || "Sin pista"}</strong><span>Finge que conoces la palabra secreta.</span></div>
          : <p className="reveal-hint"><span>Da pistas sin decirla. Uno de vosotros no la sabe.</span></p>}
      </div>
      <p className="reveal-countdown">Tu rol es privado. La ronda empieza en {remaining} s</p>
    </div>
  );
}

// === CLUE ROUND ===
function GameplayScreen({ room, myId, myRole, onSubmitWord }) {
  const players = room.players;
  const activePlayerIdx = room.activePlayerIdx ?? 0;
  const isRoundReview = room.phase === "roundReview";
  const myIdx = players.findIndex(p => p.id === myId);
  const isMyTurn = activePlayerIdx === myIdx;
  const active = players[activePlayerIdx];
  const categoryLabel = wordCategoriesLabel(room.rules?.wordCategories ?? room.rules?.wordCategory ?? "all");

  // Latest word per player; the full list lives in the clue history.
  const words = React.useMemo(() => {
    const map = {};
    for (const entry of room.wordHistory || []) map[entry.playerId] = entry.word;
    return map;
  }, [room.wordHistory]);

  const turnTotal = isRoundReview ? ROUND_REVIEW_SECONDS : room.rules?.turnTime ?? 30;
  const remaining = useServerCountdown(isRoundReview ? room.roundReviewEnd : room.timerEnd, turnTotal);
  const timeFrac = turnTotal > 0 ? Math.min(1, remaining / turnTotal) : 0;

  const amImposter = myRole?.isImpostor ?? false;
  const currentWord = amImposter ? (myRole?.hint || "Sin pista") : (myRole?.word ?? "—");

  const [secretVisible, setSecretVisible] = React.useState(true);
  const [wordInput, setWordInput] = React.useState("");
  React.useEffect(() => { setWordInput(""); }, [activePlayerIdx]);

  React.useEffect(() => {
    if (isMyTurn && !isRoundReview) play('yourTurn');
  }, [isMyTurn, isRoundReview]);

  // Tick through the last quarter of every turn.
  React.useEffect(() => {
    if (!isRoundReview && remaining > 0 && remaining <= Math.max(3, Math.ceil(turnTotal / 4))) play('timerWarning');
  }, [remaining, isRoundReview, turnTotal]);

  const wordCount = room.wordHistory?.length ?? 0;
  const prevWordCountRef = React.useRef(wordCount);
  React.useEffect(() => {
    if (wordCount > prevWordCountRef.current) play('wordSubmit');
    prevWordCountRef.current = wordCount;
  }, [wordCount]);

  const submit = () => {
    if (!isMyTurn || isRoundReview || !wordInput.trim()) return;
    onSubmitWord(wordInput.trim());
    setWordInput("");
  };

  return (
    <div className="gameplay-page screen-pad-tight" style={{ minHeight: "100vh", padding: 20, display: "flex", flexDirection: "column" }}>
      <div className="game-topbar">
        <div className="game-chips">
          <Sticker color="ink" rotate={-2}>Ronda {room.currentRound} de {room.rules?.roundsBeforeVote}</Sticker>
          <Sticker color="mustard" rotate={1}>{categoryLabel}</Sticker>
        </div>
        <button className="secret-toggle" aria-label={secretVisible ? "Ocultar mi palabra o pista" : "Mostrar mi palabra o pista"} aria-pressed={secretVisible}
          onClick={() => setSecretVisible(v => !v)} style={{ background: amImposter ? "var(--red)" : "var(--teal)", color: amImposter ? "var(--paper)" : "var(--ink)" }}>
          {secretVisible ? currentWord : "Ver mi palabra"}
        </button>
      </div>

      <div className={`gameplay-circle ${players.length > 6 ? "is-large-group" : ""}`}>
        <CircleLayout players={players} activeIdx={activePlayerIdx} words={words} timeFrac={timeFrac} timerRemaining={remaining}/>
      </div>

      <div className="gameplay-bottom">
        {isMyTurn && !isRoundReview ? (
          <div className="input-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="turn-info turn-row" style={{ flex: 1, minWidth: 200 }}>
              <Avatar name={players[myIdx]?.name ?? ""} avatarId={players[myIdx]?.avatarId} size={48} speaking/>
              <div><div className="turn-title">¡Tu turno!</div><div className="turn-sub">Escribe una palabra relacionada</div></div>
            </div>
            <input value={wordInput} onChange={e => setWordInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
              aria-label="Tu pista" placeholder="Escribe una palabra…" maxLength={20} autoFocus/>
            <button onClick={submit} disabled={!wordInput.trim()} className="btn btn--primary">Enviar</button>
          </div>
        ) : (
          <div className="turn-row">
            <Avatar name={active?.name ?? ""} avatarId={active?.avatarId} size={48} speaking/>
            <div>
              <div className="turn-title">{isRoundReview ? "Última pista de la ronda" : `${active?.name ?? ""} está pensando…`}</div>
              <div className="turn-sub">{isRoundReview ? "Siguiente fase en breve" : "Espera tu turno"}</div>
            </div>
            <div className="turn-seconds" style={{ background: timeFrac < .25 && !isRoundReview ? "var(--red)" : undefined }}>{remaining}</div>
          </div>
        )}
      </div>
      <ClueHistory room={room}/>
    </div>
  );
}

function CircleLayout({ players, activeIdx, words, timeFrac, timerRemaining }) {
  const N = players.length;
  const [size, setSize] = React.useState(520);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const measure = () => setSize(Math.min(wrapRef.current.clientWidth, wrapRef.current.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Larger groups get a grid with room for names and full clues.
  if (N > 6) return <div className="large-group" ref={wrapRef}>
    <div className="large-group-turn"><TimerRing remaining={timerRemaining} frac={timeFrac} size={70}/><span>Turno de {players[activeIdx]?.name}</span></div>
    <div className="large-group-grid">{players.map((p, i) => <div className={`large-group-player ${i === activeIdx ? 'is-active' : ''}`} key={p.id}>
      <Avatar name={p.name} avatarId={p.avatarId} size={44} speaking={i === activeIdx}/><strong>{p.name}</strong><span>{words[p.id] || 'Aún sin pista'}</span>
    </div>)}</div>
  </div>;

  const radius = Math.max(80, size * 0.33);
  const avatarSize = Math.max(50, Math.min(84, size * 0.13));

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative", minHeight: "100%" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: size, height: size, pointerEvents: "none" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          <circle cx={size/2} cy={size/2} r={radius} fill="#FFFFFF0F" stroke="#FFFFFF40" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round"/>
        </svg>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <TimerRing remaining={timerRemaining} frac={timeFrac} size={size < 400 ? 90 : 116}/>
        </div>
        {players.map((p, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
          const isActive = i === activeIdx;
          return (
            <div key={p.id} style={{
              position: "absolute", left: size/2 + Math.cos(angle) * radius, top: size/2 + Math.sin(angle) * radius,
              transform: `translate(-50%, -50%) scale(${isActive ? 1.25 : 1})`,
              transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
              zIndex: isActive ? 5 : 1, textAlign: "center",
            }}>
              <Avatar name={p.name} avatarId={p.avatarId} size={avatarSize} speaking={isActive}/>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, marginTop: 4, textShadow: "0 2px 0 var(--ink)" }}>{p.name}</div>
              {words[p.id] && <div className="word-bubble pop" style={{ top: -30, padding: "3px 10px", fontSize: 15 }}>{words[p.id]}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimerRing({ remaining, frac, size = 120 }) {
  const r = size/2 - 9;
  const low = frac < 0.25;
  return (
    <div className={low ? "pop" : ""} key={low ? "low" : "ok"} style={{ width: size, height: size, position: "relative" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="var(--paper)" stroke="var(--ink)" strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r - 6} fill="none" stroke={low ? "var(--red)" : "var(--mustard)"} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (r - 6)} strokeDashoffset={2 * Math.PI * (r - 6) * (1 - frac)}
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .4s linear" }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: size * 0.34, color: low ? "var(--red)" : "var(--ink)" }}>{remaining}</div>
    </div>
  );
}

export { RoleRevealScreen, GameplayScreen }
