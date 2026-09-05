import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'
import { ClueHistory } from './clue-history.jsx'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { wordCategoriesLabel } from '../wordCategories.js'

// components/screens-game.jsx — Role reveal, gameplay circle, results

const ROUND_REVIEW_SECONDS = 4;

// === ROLE REVEAL ===
// style: 'flash' | 'card' | 'stamp'
// Server drives phase transition via alarm — no onContinue.
function RoleRevealScreen({ theme, myRole, revealStyle = "flash", timerEnd }) {
  // myRole may briefly be null on reconnect before ROLE arrives; show neutral until it does.
  const isImposter = myRole?.isImpostor ?? false;
  const secretWord = myRole?.word ?? "";
  const hint = myRole?.hint ?? "";

  const remaining = useServerCountdown(timerEnd, 6);
  const [phase, setPhase] = React.useState(0); // 0 = hidden, 1 = reveal, 2 = show info
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  React.useEffect(() => {
    if (myRole) play(myRole.isImpostor ? 'roleImpostor' : 'roleCrewmate');
  }, [myRole]);

  const bg = isImposter ? "var(--red)" : "var(--teal)";
  const fg = "var(--paper)";
  const revealText = isImposter ? "IMPOSTOR" : secretWord.toUpperCase();
  const longestRevealSegment = Math.max(...revealText.split(/\s+/).map(segment => segment.length), 1);
  const revealWordSize = `min(22vw, ${(116 / longestRevealSegment).toFixed(2)}vw, 180px)`;

  if (!myRole) return <main className="connection-screen"><p role="status">Recuperando tu papel secreto…</p></main>;

  if (revealStyle === "card") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
        background: "var(--ink)",
      }}>
        <div style={{
          width: 320, height: 440,
          perspective: 1200,
        }}>
          <div style={{
            width: "100%", height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform 1s cubic-bezier(.5,1.5,.5,1)",
            transform: phase >= 1 ? "rotateY(180deg)" : "rotateY(0)",
          }}>
            {/* back */}
            <div style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden",
              background: "var(--mustard)",
              border: "4px solid var(--ink)", borderRadius: 20,
              boxShadow: "8px 8px 0 var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: 80,
            }}>?</div>
            {/* front */}
            <div style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: bg,
              border: "4px solid var(--ink)", borderRadius: 20,
              boxShadow: "8px 8px 0 var(--ink)",
              padding: 28,
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              textAlign: "center",
              color: fg,
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 12 }}>
                {isImposter ? "TÚ ERES EL" : "ERES UN"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 56, letterSpacing: 0, marginBottom: 24 }}>
                {isImposter ? "IMPOSTOR" : "JUGADOR"}
              </div>
              <div style={{ width: "100%", padding: "16px 12px", background: "var(--ink)", color: "var(--paper)", borderRadius: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", opacity: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
                  {isImposter ? "Pista" : "Palabra secreta"}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
                  {isImposter ? (hint || "Sin pista: ¡improvisa!") : secretWord}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (revealStyle === "stamp") {
    return (
      <div className="screen-pad" style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
        background: "var(--paper)",
      }}>
        <div className="reveal-stamp-card" style={{
          background: "repeating-linear-gradient(-45deg, var(--cream-deep) 0 14px, var(--paper) 14px 28px)",
          padding: 40,
          border: "3px solid var(--ink)",
          borderRadius: 8,
          boxShadow: "8px 8px 0 var(--ink)",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          position: "relative",
        }}>
          <div className={`reveal-stamp-inner ${phase >= 1 ? "pop" : ""}`} style={{
            display: "inline-block",
            padding: "16px 36px",
            border: `6px double ${isImposter ? "var(--red)" : "var(--teal)"}`,
            color: isImposter ? "var(--red)" : "var(--teal)",
            fontFamily: "var(--font-display)",
            fontSize: 48,
            transform: "rotate(-4deg)",
            letterSpacing: "0.08em",
          }}>
            {isImposter ? "IMPOSTOR" : "JUGADOR"}
          </div>
          {phase >= 2 && (
            <div className="slide-up" style={{ marginTop: 32 }}>
              <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 4 }}>
                {isImposter ? "Pista" : "Palabra secreta"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 36 }}>
                {isImposter ? (hint || "Sin pista: ¡improvisa!") : secretWord}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 'flash' (default) — red screen flash + shake
  return (
    <div className={phase >= 1 ? (isImposter ? "shake" : "") : ""} style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      background: bg,
      color: fg,
      position: "fixed", inset: 0, zIndex: 50,
    }}>
      <p className="reveal-countdown">Tu papel es privado · La ronda empieza en {remaining} s</p>
      {phase >= 1 && (
        <div className="flash" style={{ textAlign: "center", width: "100%" }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "min(14vw, 96px)",
            letterSpacing: 0,
            lineHeight: 0.9,
            marginBottom: 12,
          }}>
            {isImposter ? "TÚ ERES EL" : "LA PALABRA ES"}
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: revealWordSize,
            letterSpacing: 0,
            lineHeight: 1,
            WebkitTextStroke: "3px var(--ink)",
            maxWidth: "min(92vw, 980px)",
            margin: "0 auto",
            overflowWrap: "normal",
            wordBreak: "normal",
          }}>
            {revealText}
          </div>
        </div>
      )}
      {phase >= 2 && (
        <div className="slide-up" style={{ marginTop: 40, textAlign: "center", maxWidth: 500 }}>
          {isImposter ? (
            <div style={{
              padding: "20px 28px",
              background: "var(--ink)", color: "var(--paper)",
              borderRadius: 16, border: "3px solid var(--paper)",
              display: "inline-block",
            }}>
              <div style={{ fontSize: 13, letterSpacing: "0.15em", opacity: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
                Tu pista
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>{hint || "Sin pista: ¡improvisa!"}</div>
              <div style={{ fontSize: 13, marginTop: 10, opacity: 0.8 }}>Finge que conoces la palabra secreta</div>
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              Escribe una palabra relacionada sin ser demasiado obvio
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === GAMEPLAY CIRCLE ===
function GameplayScreen({ theme, room, myId, myRole, onSubmitWord }) {
  const circleLayout = theme.circleLayout || "orbit";
  const players = room.players;
  const activePlayerIdx = room.activePlayerIdx ?? 0;
  const isRoundReview = room.phase === "roundReview";
  // myIdx replaces "currentPlayerIdx" — index of the local player in the players array
  const myIdx = players.findIndex(p => p.id === myId);
  const isMyTurn = activePlayerIdx === myIdx;
  const categoryLabel = wordCategoriesLabel(room.rules?.wordCategories ?? room.rules?.wordCategory ?? "all");

  // Derive the latest-word-per-player map from wordHistory (last word wins per player).
  const words = React.useMemo(() => {
    const map = {};
    for (const entry of room.wordHistory || []) map[entry.playerId] = entry.word;
    return map;
  }, [room.wordHistory]);

  const turnTotal = isRoundReview ? ROUND_REVIEW_SECONDS : room.rules?.turnTime ?? 30;
  const remaining = useServerCountdown(isRoundReview ? room.roundReviewEnd : room.timerEnd, turnTotal);
  const timer = { remaining, total: turnTotal };
  const timeFrac = turnTotal > 0 ? Math.min(1, timer.remaining / turnTotal) : 0;

  // currentWord: the local player's role hint or secret word, used for the top-bar reminder.
  const amImposter = myRole?.isImpostor ?? false;
  const currentWord = amImposter ? (myRole?.hint ?? "—") : (myRole?.word ?? "—");

  const [secretVisible, setSecretVisible] = React.useState(true);
  const [wordInput, setWordInput] = React.useState("");
  React.useEffect(() => { setWordInput(""); }, [activePlayerIdx]);

  // SFX: your turn
  React.useEffect(() => {
    if (isMyTurn && !isRoundReview) play('yourTurn');
  }, [isMyTurn, isRoundReview]);

  // SFX: timer warning when remaining drops to/below 25% of total
  const pct = turnTotal > 0 ? remaining / turnTotal : 0;
  React.useEffect(() => {
    if (!isRoundReview && pct <= 0.25 && pct > 0) play('timerWarning');
  }, [Math.floor(pct * 4), isRoundReview]);

  // SFX: word submit (any player)
  const wordCount = room.wordHistory?.length ?? 0;
  const prevWordCountRef = React.useRef(wordCount);
  React.useEffect(() => {
    if (wordCount > prevWordCountRef.current) {
      play('wordSubmit');
    }
    prevWordCountRef.current = wordCount;
  }, [wordCount]);

  const submit = () => {
    if (!isMyTurn || isRoundReview || !wordInput.trim()) return;
    onSubmitWord(wordInput.trim());
    setWordInput("");
  };

  return (
    <div className="gameplay-page screen-pad-tight" style={{ minHeight: "100vh", padding: 20, display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Sticker color="ink" rotate={-2}>Ronda {room.currentRound} / {room.rules?.roundsBeforeVote}</Sticker>
          <Sticker color="mustard" rotate={1}>{categoryLabel}</Sticker>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>
            {amImposter ? "Pista" : "Palabra"}
          </span>
          <button className="secret-toggle" aria-label={secretVisible ? "Ocultar mi palabra o pista" : "Mostrar mi palabra o pista"} aria-pressed={secretVisible} onClick={() => setSecretVisible(v => !v)} style={{
            padding: "6px 14px",
            background: amImposter ? "var(--red)" : "var(--teal)",
            color: "var(--paper)",
            border: "2.5px solid var(--ink)",
            borderRadius: 10,
            boxShadow: "3px 3px 0 var(--ink)",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            maxWidth: 260,
            overflowWrap: "anywhere",
            textAlign: "center",
          }}>{secretVisible ? currentWord : "Mostrar secreto"}</button>
        </div>
      </div>

      {/* center — circle of avatars */}
      <div className={`gameplay-circle ${players.length > 6 ? "is-large-group" : ""}`}>
        <CircleLayout
          players={players}
          activeIdx={activePlayerIdx}
          words={words}
          layout={circleLayout}
          avatarStyle={theme.avatarStyle}
          timeFrac={timeFrac}
          timerRemaining={timer.remaining}
          timerTotal={timer.total}
        />
      </div>

      {/* bottom — my input or waiting */}
      <div className="gameplay-bottom" style={{
        padding: "20px",
        background: "var(--paper)",
        border: "3px solid var(--ink)",
        borderRadius: 20,
        boxShadow: "var(--shadow-hard-lg)",
        marginTop: 12,
      }}>
        {isRoundReview ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={players[activePlayerIdx]?.name ?? ""} avatarId={players[activePlayerIdx]?.avatarId} style={theme.avatarStyle} size={48} speaking/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                Última pista de la ronda
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                Siguiente fase en breve
              </div>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--lavender)",
              border: "3px solid var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
              boxShadow: "3px 3px 0 var(--ink)",
            }}>{timer.remaining}</div>
          </div>
        ) : isMyTurn ? (
          <div className="input-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="turn-info" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
              <Avatar name={players[myIdx]?.name ?? ""} avatarId={players[myIdx]?.avatarId} style={theme.avatarStyle} size={48} speaking/>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>Tu turno</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Escribe una palabra relacionada</div>
              </div>
            </div>
            <input
              value={wordInput}
              onChange={e => setWordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              aria-label="Tu pista"
              placeholder="Escribe una palabra..."
              maxLength={20}
              style={{
                flex: 2, minWidth: 180,
                padding: "14px 18px",
                fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600,
                border: "3px solid var(--ink)", borderRadius: 12,
                background: "var(--card)", boxShadow: "3px 3px 0 var(--ink)",
                outline: "none", color: "var(--ink)",
              }}
            />
            <button onClick={submit} disabled={!wordInput.trim()} className="btn btn--primary">
              Enviar →
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={players[activePlayerIdx]?.name ?? ""} avatarId={players[activePlayerIdx]?.avatarId} style={theme.avatarStyle} size={48} speaking/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                {players[activePlayerIdx]?.name ?? ""} está pensando...
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Espera tu turno</div>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--mustard)",
              border: "3px solid var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
              boxShadow: "3px 3px 0 var(--ink)",
            }}>{timer.remaining}</div>
          </div>
        )}
      </div>
      <ClueHistory room={room} avatarStyle={theme.avatarStyle}/>
    </div>
  );
}

function CircleLayout({ players, activeIdx, words, layout, avatarStyle, timeFrac, timerRemaining, timerTotal }) {
  const N = players.length;
  const [size, setSize] = React.useState(520);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const measure = () => {
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight;
      setSize(Math.min(w, h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Give larger groups room for names and full clues instead of crowding the orbit.
  if (N > 6) return <div className="large-group" ref={wrapRef}>
    <div className="large-group-turn"><TimerRing remaining={timerRemaining} total={timerTotal} frac={timeFrac} size={70}/><strong>Turno de {players[activeIdx]?.name}</strong></div>
    <div className="large-group-grid">{players.map((p, i) => <div className={`large-group-player ${i === activeIdx ? 'is-active' : ''}`} key={p.id}>
      <Avatar name={p.name} avatarId={p.avatarId} style={avatarStyle} size={40} speaking={i === activeIdx}/><strong>{p.name}</strong><span>{words[p.id] || 'Aún sin pista'}</span>
    </div>)}</div>
  </div>;

  if (layout === "stage") {
    // spotlight — active center, others on sides dimmed
    const active = players[activeIdx];
    if (!active) return null;
    const others = players.filter((_, i) => i !== activeIdx);
    return (
      <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ position: "relative" }} className="pop">
          <div style={{
            position: "absolute", inset: -30, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(244,185,66,0.4) 0%, transparent 70%)",
          }}/>
          <Avatar name={active.name} avatarId={active.avatarId} style={avatarStyle} size={160} speaking/>
          <div style={{ textAlign: "center", marginTop: 12, fontFamily: "var(--font-display)", fontSize: 22 }}>{active.name}</div>
          {/* impostor identity is private during play — color all word bubbles neutrally */}
          {words[active.id] && <WordBubble text={words[active.id]} color="teal"/>}
        </div>
        <div style={{ position: "absolute", bottom: 20, right: 20 }}>
          <TimerRing remaining={timerRemaining} total={timerTotal} frac={timeFrac} size={80}/>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 700, opacity: 0.5 }}>
          {others.map(p => (
            <div key={p.id} style={{ textAlign: "center" }}>
              <Avatar name={p.name} avatarId={p.avatarId} style={avatarStyle} size={44}/>
              {words[p.id] && <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>{words[p.id]}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // orbit (default) — circle of avatars around center timer
  const radius = Math.max(80, size * 0.32);
  const avatarSize = Math.max(48, Math.min(80, size * 0.12));

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative", minHeight: "100%" }}>
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width: size, height: size,
        pointerEvents: "none",
      }}>
        {/* dotted ring */}
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: "absolute", inset: 0 }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeDasharray="4 6" opacity="0.4"/>
        </svg>

        {/* center — timer + current word speaker */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          pointerEvents: "auto",
        }}>
          <TimerRing remaining={timerRemaining} total={timerTotal} frac={timeFrac} size={size < 400 ? 86 : 110}/>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, textAlign: "center", maxWidth: 160 }}>
            {players[activeIdx]?.name ?? ""}
          </div>
        </div>

        {/* avatars in circle */}
        {players.map((p, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x = size/2 + Math.cos(angle) * radius;
          const y = size/2 + Math.sin(angle) * radius;
          const active = i === activeIdx;
          const scale = active ? 1.25 : 1;
          return (
            <div key={p.id} style={{
              position: "absolute",
              left: x, top: y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
              pointerEvents: "auto",
              zIndex: active ? 5 : 1,
            }}>
              <div style={{ textAlign: "center" }}>
                <Avatar name={p.name} avatarId={p.avatarId} style={avatarStyle} size={avatarSize} speaking={active}/>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, marginTop: 4 }}>{p.name}</div>
              </div>
              {words[p.id] && <WordBubble text={words[p.id]} color="teal" compact/>}
              {active && <div className="pulse-ring" style={{ position: "absolute", inset: 0, borderRadius: "50%" }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimerRing({ remaining, total, frac, size = 120 }) {
  const r = size/2 - 8;
  const C = 2 * Math.PI * r;
  const low = frac < 0.25;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="var(--paper)" stroke="var(--ink)" strokeWidth="3"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={low ? "var(--red)" : "var(--teal)"}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset .4s linear" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontSize: size * 0.28,
        color: low ? "var(--red)" : "var(--ink)",
      }}>{remaining}</div>
    </div>
  );
}

function WordBubble({ text, color = "teal", compact = false }) {
  const bg = color === "red" ? "var(--red)" : color === "mustard" ? "var(--mustard)" : "var(--teal)";
  const fg = color === "mustard" ? "var(--ink)" : "var(--paper)";
  return (
    <div className="pop" style={{
      position: "absolute",
      top: compact ? -24 : -40,
      left: "50%",
      transform: "translateX(-50%) rotate(-3deg)",
      padding: compact ? "4px 10px" : "8px 14px",
      background: bg, color: fg,
      border: "2.5px solid var(--ink)",
      borderRadius: 14,
      boxShadow: "3px 3px 0 var(--ink)",
      fontFamily: "var(--font-display)",
      fontSize: compact ? 11 : 14,
      whiteSpace: "nowrap",
      zIndex: 10,
    }}>{text}</div>
  );
}

export { RoleRevealScreen, GameplayScreen }
