import React from 'react'
import { Sticker, Avatar } from './primitives.jsx'
import { play } from '../audio/soundManager.js'
import { useServerCountdown } from '../ws/useServerCountdown.js'
import { WORD_CATEGORIES, normalizeWordCategories, wordCategoriesLabel } from '../wordCategories.js'
import { getInviteUrl, getWhatsAppShareUrl, sharePayload, track } from '../analytics.js'

// components/screens-lobby.jsx — Lobby, countdown

function LobbyScreen({ theme, room, myId, amOwner, onReady, onUpdateRules, onStartGame, onLeave }) {
  const [feedback, setFeedback] = React.useState('');
  const inviteUrl = getInviteUrl(room.code);
  const inviteText = `Únete a mi sala de El Impostor (${room.code})`;
  const connected = room.players.filter(p => p.connected !== false);
  const waiting = connected.filter(p => !p.ready && !p.isOwner);
  const missing = Math.max(0, 3 - connected.length);
  const canStart = amOwner && !missing && !waiting.length;
  const iAmReady = room.players.find(p => p.id === myId)?.ready;
  const categories = wordCategoriesLabel(room.rules.wordCategories ?? room.rules.wordCategory ?? 'all');
  const status = missing ? `Invita a ${missing} ${missing === 1 ? 'amigo más' : 'amigos más'} para empezar.`
    : waiting.length ? `Esperando a ${waiting.map(p => p.id === myId ? 'ti' : p.name).join(', ')}. Marcad «Estoy listo» para empezar.`
    : 'Todo el grupo está listo.';

  const copy = async (value, kind) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(value);
      setFeedback(kind === 'code' ? 'Código copiado.' : 'Enlace copiado. Compártelo con tus amigos.');
      track(kind === 'code' ? 'copy_room_code' : 'share_invite', { method: 'copy_link' });
    } catch { setFeedback('No se pudo copiar. Mantén pulsado el enlace de invitación para copiarlo.'); }
  };
  const invite = async () => {
    try {
      const method = await sharePayload({ title: 'El Impostor', text: inviteText, url: inviteUrl });
      if (method && method !== 'cancelled') setFeedback(method === 'native' ? 'Invitación compartida.' : 'Invitación copiada. Pégala en tu grupo.');
    } catch { setFeedback('Usa el enlace de invitación o el botón de WhatsApp para invitar.'); }
  };

  return (
    <main className="lobby-page screen-pad">
      <header className="lobby-header">
        <button onClick={onLeave} className="btn btn--ghost btn--sm">← Salir</button>
        <div className="room-code-row">
          <Sticker color="mustard" rotate={-2}>Sala · {room.code}</Sticker>
          <button onClick={() => copy(room.code, 'code')} className="text-button" aria-label="Copiar código de sala">Copiar código</button>
        </div>
      </header>
      <div className="lobby-heading">
        <p className="eyebrow-text">{missing ? 'Reúne a tu grupo' : `Ya sois ${connected.length}`}</p>
        <h1>Que empiecen las sospechas.</h1>
        <p>Un secreto. Tus amigos. Alguien tendrá que improvisar.</p>
      </div>
      <div className="lobby-layout">
        <section className="card lobby-players" aria-labelledby="players-title">
          <div className="section-heading"><h2 id="players-title">El grupo</h2><span>{connected.length} / {room.rules.maxPlayers}</span></div>
          <div className="lobby-player-list">
            {room.players.map(p => <PlayerCard key={p.id} player={p} avatarStyle={theme.avatarStyle} isMe={p.id === myId}/>)}
          </div>
          {missing > 0 && <p className="lobby-empty">{missing === 1 ? 'Falta una persona para la primera partida.' : `Faltan ${missing} personas para la primera partida.`}</p>}
          <div className="invite-actions">
            <button onClick={invite} className="btn btn--teal btn--sm">Invitar amigos ↗</button>
            <a className="btn btn--ghost btn--sm" href={getWhatsAppShareUrl(inviteText, inviteUrl)} target="_blank" rel="noreferrer" onClick={() => track('share_invite', { method: 'whatsapp' })}>WhatsApp</a>
          </div>
          <details className="invite-details">
            <summary>Ver enlace de invitación</summary>
            <p className="invite-url">{inviteUrl}</p>
            <button className="text-button" onClick={() => copy(inviteUrl, 'link')}>Copiar enlace</button>
          </details>
          <p className="inline-feedback" role="status">{feedback}</p>
        </section>
        <aside className="lobby-controls">
          <div className="card lobby-start">
            <p className="lobby-status" role="status">{status}</p>
            {amOwner ? <button className="btn btn--primary btn--block" disabled={!canStart} onClick={onStartGame}>
              {missing ? `Faltan ${missing} ${missing === 1 ? 'jugador' : 'jugadores'}` : waiting.length ? 'Esperando al grupo' : 'Empezar partida →'}
            </button> : <button className={`btn btn--block ${iAmReady ? 'btn--teal' : 'btn--mustard'}`} disabled={iAmReady} onClick={onReady}>{iAmReady ? '✓ Listo' : 'Estoy listo →'}</button>}
            <p className="lobby-help">{amOwner ? 'Tú eres el anfitrión.' : 'El anfitrión empezará cuando estéis listos.'} Jugad juntos o por llamada.</p>
          </div>
          <div className="card lobby-settings">
            <p className="eyebrow-text">Vuestra partida</p>
            <p className="rules-summary">{categories} · {room.rules.turnTime} s · {room.rules.roundsBeforeVote} {room.rules.roundsBeforeVote === 1 ? 'ronda' : 'rondas'}</p>
            {amOwner ? <details>
              <summary>Personalizar partida</summary>
              <div className="rules-fields">
                <RuleRow label="Tiempo por turno" value={`${room.rules.turnTime}s`} min={10} max={60} step={5} current={room.rules.turnTime} editable onChange={v => onUpdateRules({ turnTime: v })}/>
                <RuleRow label="Rondas antes de votar" value={room.rules.roundsBeforeVote} min={1} max={5} step={1} current={room.rules.roundsBeforeVote} editable onChange={v => onUpdateRules({ roundsBeforeVote: v })}/>
                <CategoryRow value={room.rules.wordCategories ?? room.rules.wordCategory ?? 'all'} editable onChange={v => onUpdateRules({ wordCategories: v })}/>
                <RuleRow label="Máximo de jugadores" value={room.rules.maxPlayers} min={Math.max(3, connected.length)} max={12} step={1} current={room.rules.maxPlayers} editable onChange={v => onUpdateRules({ maxPlayers: v })}/>
                <ToggleRow label="Dar una pista al impostor" value={room.rules.imposterHasHint} editable onChange={v => onUpdateRules({ imposterHasHint: v })}/>
              </div>
            </details> : <p className="lobby-help">{room.rules.imposterHasHint ? 'El impostor recibe una pista.' : 'El impostor juega sin pista.'} El anfitrión puede ajustar las reglas.</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function PlayerCard({ player, avatarStyle, isMe }) {
  const disconnected = player.connected === false;
  return <div className={`lobby-player ${disconnected ? 'is-disconnected' : ''}`}>
    <Avatar name={player.name} style={avatarStyle} size={46} showCrown={player.isOwner}/>
    <div className="lobby-player-name"><strong>{player.name}</strong><small>{[isMe && 'Tú', player.isOwner && 'Anfitrión'].filter(Boolean).join(' · ')}</small></div>
    <span className={`player-status ${player.ready || player.isOwner ? 'is-ready' : ''}`}>{disconnected ? 'Sin conexión' : player.ready || player.isOwner ? '✓ Listo' : 'Esperando'}</span>
  </div>;
}

function RuleRow({ label, value, min, max, step, current, editable, onChange, suffix = "" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
          padding: "2px 10px",
          background: "var(--mustard)",
          border: "2px solid var(--ink)",
          borderRadius: 8,
        }}>{value}</span>
      </div>
      {editable && (
        <input
          aria-label={label}
          type="range" min={min} max={max} step={step} value={current}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--red)" }}
        />
      )}
    </div>
  );
}

function CategoryRow({ value, editable, onChange }) {
  const selectedCategories = normalizeWordCategories(value);
  const toggleCategory = (categoryId) => {
    if (!editable) return;
    if (categoryId === "all") {
      onChange(["all"]);
      return;
    }
    const current = selectedCategories.includes("all") ? [] : selectedCategories;
    const next = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    onChange(next.length === 0 ? ["all"] : next);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Categorías</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
          padding: "2px 10px",
          background: "var(--lavender)",
          border: "2px solid var(--ink)",
          borderRadius: 8,
        }}>
          {wordCategoriesLabel(selectedCategories)}
        </span>
      </div>
      <div className="category-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
      }}>
        {WORD_CATEGORIES.map(category => {
          const selected = selectedCategories.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              disabled={!editable}
              aria-pressed={selected}
              onClick={() => toggleCategory(category.id)}
              style={{
                minHeight: 34,
                padding: "6px 10px",
                background: selected ? "var(--ink)" : "var(--paper)",
                color: selected ? "var(--paper)" : "var(--ink)",
                border: "2px solid var(--ink)",
                borderRadius: 8,
                boxShadow: selected ? "2px 2px 0 var(--mustard)" : "2px 2px 0 var(--ink)",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                cursor: editable ? "pointer" : "default",
                opacity: editable || selected ? 1 : 0.55,
              }}
            >
              {category.label}
            </button>
          );
        })}
      </div>

    </div>
  );
}

function ToggleRow({ label, value, editable, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{label}</span>
      <button
        role="switch" aria-checked={value} aria-label={label}
        disabled={!editable}
        onClick={() => onChange(!value)}
        style={{
          width: 52, height: 30,
          borderRadius: 999,
          background: value ? "var(--teal)" : "var(--cream-deep)",
          border: "2.5px solid var(--ink)",
          position: "relative",
          boxShadow: "2px 2px 0 var(--ink)",
          cursor: editable ? "pointer" : "default",
          opacity: editable ? 1 : 0.7,
        }}
      >
        <div style={{
          position: "absolute",
          top: 1, left: value ? 22 : 1,
          width: 22, height: 22, borderRadius: "50%",
          background: "var(--paper)", border: "2px solid var(--ink)",
          transition: "left .15s ease",
        }}/>
      </button>
    </div>
  );
}

// === COUNTDOWN ===
// Server drives phase transition via alarm; this component is a 4s visual animation only.
function CountdownScreen({ theme, timerEnd }) {
  const remaining = useServerCountdown(timerEnd, 4);
  const n = Math.max(0, remaining - 1);
  React.useEffect(() => { if (n > 0) play('tick'); }, [n]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--ink)", position: "fixed", inset: 0, zIndex: 100,
    }}>
      <div key={n} className="pop" style={{
        fontFamily: "var(--font-display)",
        fontSize: "min(40vw, 340px)",
        color: n === 0 ? "var(--mustard)" : "var(--red)",
        WebkitTextStroke: "6px var(--paper)",
        letterSpacing: 0,
        lineHeight: 1,
        textShadow: "12px 12px 0 var(--paper)",
      }}>
        {n === 0 ? "¡YA!" : n}
      </div>
    </div>
  );
}

export { LobbyScreen, CountdownScreen }
