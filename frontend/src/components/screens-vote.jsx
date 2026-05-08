import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'

// components/screens-vote.jsx — between-round, voting, results

function BetweenRoundScreen({ theme, room, myId, onVote }) {
  const continueVotes = room.betweenRoundVotes?.continue || [];
  const voteVotes = room.betweenRoundVotes?.vote || [];
  const votesToContinue = continueVotes.length;
  const votesToVote = voteVotes.length;
  const myVote = continueVotes.includes(myId)
    ? "continue"
    : voteVotes.includes(myId) ? "vote" : null;
  const total = room.players.filter(p => p.connected !== false).length;

  return (
    <div className="screen-pad" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Sticker color="ink" rotate={-2} size="lg">Fin de ronda {room.currentRound}</Sticker>

      <h1 className="between-title" style={{ fontFamily: "var(--font-display)", fontSize: 48, marginTop: 24, marginBottom: 8, textAlign: "center" }}>
        ¿Qué hacen ahora?
      </h1>
      <p style={{ color: "var(--ink-soft)", textAlign: "center", maxWidth: 480, marginTop: 0 }}>
        Voten entre seguir jugando otra ronda o ir directo a la votación.
      </p>

      <div style={{ display: "flex", gap: 24, marginTop: 40, flexWrap: "wrap", justifyContent: "center" }}>
        <VoteCard
          title="Otra ronda"
          subtitle="Más pistas, más dudas"
          count={votesToContinue}
          total={total}
          selected={myVote === "continue"}
          color="teal"
          onClick={() => myVote == null && onVote("continue")}
          icon="↻"
        />
        <VoteCard
          title="Votar ya"
          subtitle="Descubrir al impostor"
          count={votesToVote}
          total={total}
          selected={myVote === "vote"}
          color="red"
          onClick={() => myVote == null && onVote("vote")}
          icon="⚖"
        />
      </div>

      <div style={{ marginTop: 36, fontSize: 13, color: "var(--ink-soft)" }}>
        Gana la opción con más votos
      </div>
    </div>
  );
}

function VoteCard({ title, subtitle, count, total, selected, color, onClick, icon }) {
  const bg = color === "red" ? "var(--red)" : "var(--teal)";
  return (
    <button className="vote-card" onClick={onClick} style={{
      width: 240, padding: 24,
      background: selected ? bg : "var(--card)",
      color: selected ? "var(--paper)" : "var(--ink)",
      border: "3px solid var(--ink)",
      borderRadius: 20,
      boxShadow: selected ? "6px 6px 0 var(--ink)" : "4px 4px 0 var(--ink)",
      cursor: "pointer",
      transform: selected ? "translate(-2px,-2px) rotate(-1deg)" : "rotate(0)",
      transition: "transform .15s ease, box-shadow .15s ease",
      textAlign: "left",
    }}>
      <div className="icon" style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>{icon}</div>
      <div className="title" style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{subtitle}</div>
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 10, background: "var(--ink)", borderRadius: 6, overflow: "hidden", opacity: 0.3 }}>
          <div style={{ width: `${(count/total)*100}%`, height: "100%", background: selected ? "var(--paper)" : bg, transition: "width .3s" }}/>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>{count}/{total}</span>
      </div>
    </button>
  );
}

// === VOTING SCREEN ===
function VotingScreen({ theme, room, myId, onCastVote, onConfirmVote }) {
  const avatarStyle = theme.avatarStyle;
  const votes = room.votes || {};
  const myVote = votes[myId] || null;
  const confirmed = (room.confirmedVotes || []).includes(myId);

  // Local live countdown derived from server's votingTimerEnd.
  const computeRemaining = () => {
    if (!room.votingTimerEnd) return 0;
    return Math.max(0, Math.ceil((room.votingTimerEnd - Date.now()) / 1000));
  };
  const [timer, setTimer] = React.useState(computeRemaining);
  React.useEffect(() => {
    setTimer(computeRemaining());
    const id = setInterval(() => setTimer(computeRemaining()), 250);
    return () => clearInterval(id);
  }, [room.votingTimerEnd]);

  const onVote = (id) => {
    if (!confirmed) {
      play('voteCast');
      onCastVote(id);
    }
  };
  const onConfirm = () => { if (myVote && !confirmed) onConfirmVote(); };

  return (
    <div className="screen-pad" style={{
      minHeight: "100vh",
      padding: 24,
      position: "relative",
    }}>
      {/* blurred bg */}
      <div style={{
        position: "fixed", inset: 0,
        background: "var(--ink)",
        backgroundImage: "radial-gradient(circle at 20% 30%, var(--red) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--teal) 0%, transparent 40%)",
        filter: "blur(60px) saturate(1.2)",
        opacity: 0.35,
        zIndex: 0,
      }}/>
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Sticker color="red" rotate={-3} size="lg">Tiempo de votar</Sticker>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "min(10vw, 64px)", margin: "16px 0 4px", letterSpacing: "-0.02em" }}>
            ¿Quién es el impostor?
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: 0, fontWeight: 600 }}>
            Elige al jugador que crees que no tiene la palabra
          </p>
        </div>

        <div className="voting-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 18,
          maxWidth: 900, margin: "0 auto",
        }}>
          {room.players.map(p => {
            const selected = myVote === p.id;
            const voteCount = Object.values(votes).filter(v => v === p.id).length;
            return (
              <button key={p.id} className="voting-card" onClick={() => onVote(p.id)} style={{
                padding: 18,
                background: selected ? "var(--red)" : "var(--card)",
                color: selected ? "var(--paper)" : "var(--ink)",
                border: "3px solid var(--ink)",
                borderRadius: 18,
                boxShadow: selected ? "6px 6px 0 var(--ink)" : "4px 4px 0 var(--ink)",
                cursor: "pointer",
                transform: selected ? "translate(-2px,-2px) rotate(-1.5deg)" : "rotate(0)",
                transition: "all .12s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                position: "relative",
              }}>
                <Avatar name={p.name} style={avatarStyle} size={80}/>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{p.name}</div>
                {voteCount > 0 && (
                  <div style={{
                    position: "absolute", top: -10, right: -10,
                    width: 30, height: 30, borderRadius: "50%",
                    background: "var(--mustard)", color: "var(--ink)",
                    border: "2.5px solid var(--ink)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: 14,
                    boxShadow: "2px 2px 0 var(--ink)",
                  }}>{voteCount}</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            padding: "8px 16px",
            background: "var(--ink)", color: "var(--paper)",
            borderRadius: 999,
            fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
          }}>
            {timer}s restantes
          </div>
          <button
            onClick={onConfirm}
            disabled={!myVote || confirmed}
            className="btn btn--primary"
          >
            {confirmed ? "✓ Voto confirmado" : "Confirmar voto →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === RESULTS ===
function ResultsScreen({ theme, room, myId, onPlayAgain, onBackToLobby }) {
  const avatarStyle = theme.avatarStyle;
  const result = room.result || {};
  const imposterFound = !!result.found;
  // Look up impostor in players (preferred — keeps avatar consistency) with name fallback.
  const imposter = room.players.find(p => p.id === result.impostorId)
    || { id: result.impostorId, name: result.impostorName || "?" };
  const secretWord = result.secretWord || "—";
  const voteTally = result.tally || {};
  const winner = imposterFound ? "jugadores" : "impostor";
  const bg = imposterFound ? "var(--teal)" : "var(--red)";

  React.useEffect(() => {
    play(result.found ? 'win' : 'lose');
  }, []);

  return (
    <div className="screen-pad" style={{ minHeight: "100vh", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="pop" style={{
        padding: "12px 32px",
        background: bg,
        color: "var(--paper)",
        border: "3px solid var(--ink)",
        borderRadius: 999,
        fontFamily: "var(--font-display)",
        fontSize: 18,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        boxShadow: "5px 5px 0 var(--ink)",
        transform: "rotate(-2deg)",
        textAlign: "center",
      }}>
        {imposterFound ? "Impostor descubierto" : "Impostor se salió con la suya"}
      </div>

      <h1 className="results-title" style={{
        fontFamily: "var(--font-display)",
        fontSize: "min(14vw, 96px)",
        letterSpacing: "-0.03em",
        margin: "20px 0 12px",
        textAlign: "center",
        lineHeight: 0.9,
      }}>
        GANAN <span style={{ color: bg, WebkitTextStroke: "2px var(--ink)" }}>
          {winner.toUpperCase()}
        </span>
      </h1>

      <div className="card slide-up results-card" style={{
        padding: 28, background: "var(--paper)",
        maxWidth: 540, width: "100%",
        marginTop: 24,
      }}>
        <div className="imposter-row" style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Avatar name={imposter.name} style={avatarStyle} size={96}/>
            {/* mask overlay */}
            <div style={{
              position: "absolute", top: "30%", left: "10%", right: "10%",
              height: "22%",
              background: "var(--ink)",
              borderRadius: 8,
              border: "3px solid var(--paper)",
              clipPath: "polygon(0 20%, 15% 0, 40% 15%, 60% 15%, 85% 0, 100% 20%, 100% 100%, 0 100%)",
            }}/>
          </div>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>
              El impostor era
            </div>
            <div className="imposter-name" style={{ fontFamily: "var(--font-display)", fontSize: 36, marginTop: 4, wordBreak: "break-word" }}>{imposter.name}</div>
          </div>
        </div>

        <div style={{ padding: 16, background: "var(--cream-deep)", borderRadius: 12, border: "2.5px dashed var(--ink)" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700, marginBottom: 4 }}>
            La palabra secreta era
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>{secretWord}</div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700, marginBottom: 10 }}>
            Votos
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {room.players.map(p => {
              const count = voteTally[p.id] || 0;
              const isImp = p.id === result.impostorId;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                  background: isImp ? "var(--red)" : "var(--card)",
                  color: isImp ? "var(--paper)" : "var(--ink)",
                  border: "2.5px solid var(--ink)", borderRadius: 999,
                  fontSize: 13, fontWeight: 600,
                }}>
                  <Avatar name={p.name} style={avatarStyle} size={24}/>
                  {p.name} · {count}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onPlayAgain} className="btn btn--primary">
          ↻ Otra partida
        </button>
        {onBackToLobby && (
          <button onClick={onBackToLobby} className="btn btn--mustard">
            Volver al lobby
          </button>
        )}
      </div>
    </div>
  );
}

export { BetweenRoundScreen, VotingScreen, ResultsScreen }
