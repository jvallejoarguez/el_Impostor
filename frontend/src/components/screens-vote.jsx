import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'
import { PlayerClues, ClueHistory } from './clue-history.jsx'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { getNewGroupUrl, getWhatsAppShareUrl, sharePayload, track } from '../analytics.js'
import { PostGameRating } from './feedback.jsx'

// components/screens-vote.jsx — between-round, voting, results

function BetweenRoundScreen({ room, myId, onVote }) {
  const continueVotes = room.betweenRoundVotes?.continue || [];
  const voteVotes = room.betweenRoundVotes?.vote || [];
  const myVote = continueVotes.includes(myId) ? "continue" : voteVotes.includes(myId) ? "vote" : null;
  const total = room.players.filter(p => p.connected !== false).length;
  const remaining = useServerCountdown(room.timerEnd, 30);
  const choose = choice => { if (myVote == null) { play('voteCast'); onVote(choice); } };

  return (
    <div className="between-page screen-pad">
      <Sticker color="ink" rotate={-2} size="lg">Fin de la ronda {room.currentRound}</Sticker>
      <h1 className="between-title">¿Otra ronda o votar?</h1>
      <div className="between-options">
        <VoteCard title="Otra ronda" subtitle="Una pista más cada uno" icon="↻" count={continueVotes.length} total={total}
          disabled={myVote != null} selected={myVote === "continue"} onClick={() => choose("continue")}/>
        <VoteCard title="Votar ya" subtitle="Elegir al impostor" icon="!" isVote count={voteVotes.length} total={total}
          disabled={myVote != null} selected={myVote === "vote"} onClick={() => choose("vote")}/>
      </div>
      <p className="between-note">
        {myVote ? "Tu elección está guardada. Esperando al grupo…" : "En caso de empate, se pasa a votar."}
        {room.timerEnd ? ` Quedan ${remaining} s.` : ""}
      </p>
      <ClueHistory room={room}/>
    </div>
  );
}

function VoteCard({ title, subtitle, icon, isVote, count, total, selected, onClick, disabled }) {
  return (
    <button className="vote-card" disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <div className="icon" aria-hidden="true" style={{ color: isVote ? "var(--red)" : "var(--teal-deep)" }}>{icon}</div>
      <div className="title">{title}</div>
      <div className="sub">{subtitle}</div>
      <div className={`vote-meter ${isVote ? "is-vote" : ""}`}>
        <span><i style={{ width: `${total ? (count / total) * 100 : 0}%` }}/></span>
        <span>{count}/{total}</span>
      </div>
    </button>
  );
}

// === VOTING ===
function VotingScreen({ room, myId, onCastVote, onConfirmVote }) {
  const votes = room.votes || {};
  const myVote = votes[myId] || null;
  const confirmed = (room.confirmedVotes || []).includes(myId);
  const timer = useServerCountdown(room.votingTimerEnd, 30);
  const onVote = id => { if (!confirmed) { play('voteCast'); onCastVote(id); } };
  const onConfirm = () => { if (myVote && !confirmed) { play('wordSubmit'); onConfirmVote(); } };
  const selectedName = room.players.find(p => p.id === myVote)?.name;

  return <main className="voting-page">
    <header className="voting-heading"><h1>¿Quién es?</h1><p>Repasa las pistas, elige a alguien y confirma tu voto.</p></header>
    <div className="voting-list">{room.players.map(p => {
      const selected = myVote === p.id;
      return <button key={p.id} className={`suspect-card ${selected ? 'is-selected' : ''}`} onClick={() => onVote(p.id)} disabled={confirmed} aria-pressed={selected} aria-label={`Votar a ${p.name}`}>
        <Avatar name={p.name} avatarId={p.avatarId} size={54}/>
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
function ResultsScreen({ room, onPlayAgain, onBackToLobby, onNewGroup }) {
  const result = room.result || {};
  const imposterFound = !!result.found;
  const imposter = room.players.find(p => p.id === result.impostorId) || { id: result.impostorId, name: result.impostorName || "?" };
  const secretWord = result.secretWord || "—";
  const voteTally = result.tally || {};
  const [feedback, setFeedback] = React.useState('');
  const resultText = `${imposterFound ? 'Hemos descubierto al impostor' : 'Ha ganado el impostor'} en El Impostor. La palabra era ${secretWord}.`;
  const inviteUrl = getNewGroupUrl();

  React.useEffect(() => { play(result.found ? 'win' : 'lose'); }, [result.found]);

  const shareResult = async () => {
    try {
      const method = await sharePayload({ title: 'Resultado de El Impostor', text: resultText, url: inviteUrl }, { phase: 'results', methodContext: 'result' });
      if (method === 'copy_fallback') setFeedback('Resultado y enlace copiados. Pégalos en tu grupo.');
    } catch { setFeedback('No se pudo compartir. Prueba con WhatsApp.'); }
  };

  return (
    <div className="results-page screen-pad">
      <h1 className={`results-title slam ${imposterFound ? "" : "is-impostor"}`}>{imposterFound ? "¡Gana el grupo!" : "¡Gana el impostor!"}</h1>

      <div className="card results-card slide-up">
        <div className="imposter-row">
          <Avatar name={imposter.name} avatarId={imposter.avatarId} size={96}/>
          <div><div className="result-label">El impostor era</div><div className="imposter-name">{imposter.name}</div></div>
        </div>
        <div className="result-word"><div className="result-label">La palabra secreta era</div><div>{secretWord}</div></div>
        <div style={{ marginTop: 20 }}>
          <div className="result-label" style={{ marginBottom: 10 }}>Votos</div>
          <div className="result-votes">{room.players.map(p => (
            <div key={p.id} className={`result-vote ${p.id === result.impostorId ? "is-impostor" : ""}`}>
              <Avatar name={p.name} avatarId={p.avatarId} size={28}/>{p.name} · {voteTally[p.id] || 0}
            </div>
          ))}</div>
        </div>
      </div>

      {result.tied && <p className="helper-text">Empate en los votos: el impostor escapa.</p>}
      <div className="results-actions">
        <button onClick={onPlayAgain} className="btn btn--primary btn--lg btn--block">↻ Otra partida</button>
        {onBackToLobby && <button onClick={onBackToLobby} className="btn btn--ghost btn--block">Cambiar reglas</button>}
        <button onClick={onNewGroup} className="text-button">Jugar con otro grupo →</button>
        <details className="result-share"><summary>Compartir resultado</summary><div className="result-share-actions">
          <button onClick={shareResult} className="btn btn--ghost btn--sm">Compartir</button>
          <a className="text-button" href={getWhatsAppShareUrl(resultText, inviteUrl)} target="_blank" rel="noreferrer" onClick={() => track('share_invite', { method: 'whatsapp_result' })}>WhatsApp ↗</a>
        </div></details>
        <p className="inline-feedback" role="status">{feedback}</p>
      </div>
      <PostGameRating gameId={room.gameId}/>
      <ClueHistory room={room}/>
    </div>
  );
}

export { BetweenRoundScreen, VotingScreen, ResultsScreen }
