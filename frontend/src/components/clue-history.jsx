import React from 'react'
import { Avatar } from './primitives.jsx'

export function PlayerClues({ history = [], playerId }) {
  const clues = history.filter(entry => entry.playerId === playerId)
  return <span className="player-clues">{clues.length ? clues.map((entry, i) => <span className="clue-chip" key={`${entry.round}-${i}`}><span className="clue-round">R{entry.round}</span> {entry.word && entry.word !== '...' ? entry.word : 'Sin pista'}</span>) : <span className="no-clues">Aún sin pistas</span>}</span>
}

export function ClueHistory({ room, avatarStyle, expanded = false }) {
  return <details className="card clue-history" open={expanded || undefined}>
    <summary>Pistas de la partida <span>{room.wordHistory?.length || 0}</span></summary>
    <div className="clue-history-list">{room.players.map(p => <div className="clue-history-player" key={p.id}><div className="clue-person"><Avatar name={p.name} style={avatarStyle} size={30}/><strong>{p.name}</strong></div><PlayerClues history={room.wordHistory} playerId={p.id}/></div>)}</div>
  </details>
}
