import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'
import { PlayerClues, ClueHistory } from './clue-history.jsx'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { downloadResultCard } from '../resultCard.js'
import { getInviteUrl, getWhatsAppShareUrl, sharePayload, track } from '../analytics.js'

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
        ¿Otra ronda o lo tenéis claro?
      </h1>
      <p style={{ color: "var(--ink-soft)", textAlign: "center", maxWidth: 480, marginTop: 0 }}>
        Elegid si queréis más pistas o si ya podéis señalar a alguien.
      </p>

      <div style={{ display: "flex", gap: 24, marginTop: 40, flexWrap: "wrap", justifyContent: "center" }}>
        <VoteCard
          title="Otra ronda"
          subtitle="Más pistas, más dudas"
          count={votesToContinue}
          total={total}
          disabled={myVote != null}
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
          disabled={myVote != null}
          selected={myVote === "vote"}
          color="red"
          onClick={() => myVote == null && onVote("vote")}
          icon="⚖"
        />
      </div>

      <div style={{ marginTop: 36, fontSize: 13, color: "var(--ink-soft)" }}>
        {myVote ? "Tu elección está guardada. Esperando al grupo…" : "En caso de empate, se pasa a votar."}
      </div>
      <ClueHistory room={room} avatarStyle={theme.avatarStyle}/>
    </div>
  );
}

function VoteCard({ title, subtitle, count, total, selected, color, onClick, icon, disabled }) {
  const bg = color === "red" ? "var(--red)" : "var(--teal)";
  return (
    <button className="vote-card" disabled={disabled} aria-pressed={selected} onClick={onClick} style={{
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

  const timer = useServerCountdown(room.votingTimerEnd, 30);
  const onVote = (id) => {
    if (!confirmed) {
      play('voteCast');
      onCastVote(id);
    }
  };
  const onConfirm = () => { if (myVote && !confirmed) onConfirmVote(); };

  const selectedName = room.players.find(p => p.id === myVote)?.name;
  return <main className="voting-page screen-pad">
    <header className="voting-heading"><Sticker color="red" rotate={-2}>Tiempo de votar</Sticker><h1>¿Quién está fingiendo?</h1><p>Repasa las pistas, elige a alguien y confirma tu voto.</p></header>
    <div className="voting-list">{room.players.map(p => {
      const selected = myVote === p.id;
      return <button key={p.id} className={`suspect-card ${selected ? 'is-selected' : ''}`} onClick={() => onVote(p.id)} disabled={confirmed} aria-pressed={selected} aria-label={`Votar a ${p.name}`}>
        <Avatar name={p.name} style={avatarStyle} size={54}/>
        <span className="suspect-content"><strong>{p.name} {p.id === myId && <small>(tú)</small>}</strong><PlayerClues history={room.wordHistory} playerId={p.id}/></span>
        <span className="suspect-check" aria-hidden="true">{selected ? '✓' : ''}</span>
      </button>;
    })}</div>
    <div className="vote-confirmation card">
      <div className="vote-progress"><span className="vote-timer">{timer} s</span><span>{(room.confirmedVotes || []).length} / {room.players.filter(p => p.connected !== false).length} votos confirmados</span></div>
      <p role="status">{confirmed ? `Has votado a ${selectedName}. Esperando al grupo…` : selectedName ? `Vas a votar a ${selectedName}. Al confirmar no podrás cambiarlo.` : 'Selecciona a un jugador para votar.'}</p>
      <button className="btn btn--primary btn--block" disabled={!myVote || confirmed} onClick={onConfirm}>{confirmed ? '✓ Voto confirmado' : 'Confirmar voto →'}</button>
    </div>
  </main>;
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
  const winner = imposterFound ? "el grupo" : "el impostor";
  const [feedback, setFeedback] = React.useState('');
  const bg = imposterFound ? "var(--teal)" : "var(--red)";
  const resultText = `Partida de El Impostor: gana ${winner}. El impostor era ${imposter.name} y la palabra era ${secretWord}.`;
  const inviteUrl = getInviteUrl(room.code);

  React.useEffect(() => {
    play(result.found ? 'win' : 'lose');
  }, [result.found]);

  const shareResult = async () => {
    try {
      const method = await sharePayload({ title: 'Resultado de El Impostor', text: resultText, url: inviteUrl }, { phase: 'results', methodContext: 'result' });
      if (method === 'copy_fallback') setFeedback('Resultado y enlace copiados. Pégalos en tu grupo.');
    } catch { setFeedback('No se pudo compartir. Puedes guardar la tarjeta o usar WhatsApp.'); }
  };
  const saveCard = async () => {
    try { await downloadResultCard(room); setFeedback('Tarjeta descargada. Lista para compartir.'); track('download_result_card', { gameId: room.gameId }); }
    catch { setFeedback('No se pudo guardar la tarjeta. Prueba a compartir el resultado.'); }
  };

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
        {imposterFound ? "Impostor descubierto" : "El impostor se ha salido con la suya"}
      </div>

      <h1 className="results-title" style={{
        fontFamily: "var(--font-display)",
        fontSize: "min(14vw, 96px)",
        letterSpacing: 0,
        margin: "20px 0 12px",
        textAlign: "center",
        lineHeight: 0.9,
      }}>
        GANA <span style={{ color: bg, WebkitTextStroke: "2px var(--ink)" }}>
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
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, overflowWrap: "anywhere" }}>{secretWord}</div>
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

      {result.tied && <p className="helper-text">Empate en los votos: el impostor escapa.</p>}
      <div className="results-actions">
        <button onClick={onPlayAgain} className="btn btn--primary btn--block">↻ Otra partida</button>
        {onBackToLobby && <button onClick={onBackToLobby} className="btn btn--ghost btn--block">Cambiar reglas</button>}
        <details className="result-share"><summary>Comparte cómo ha acabado</summary><div className="result-share-actions">
          <button onClick={shareResult} className="btn btn--ghost btn--sm">Compartir resultado</button>
          <button onClick={saveCard} className="btn btn--ghost btn--sm">Guardar tarjeta</button>
          <a className="text-button" href={getWhatsAppShareUrl(resultText, inviteUrl)} target="_blank" rel="noreferrer" onClick={() => track('share_invite', { method: 'whatsapp_result' })}>WhatsApp ↗</a>
        </div></details>
        <p className="inline-feedback" role="status">{feedback}</p>
      </div>
      <ClueHistory room={room} avatarStyle={avatarStyle}/>
    </div>
  );
}

export { BetweenRoundScreen, VotingScreen, ResultsScreen }
