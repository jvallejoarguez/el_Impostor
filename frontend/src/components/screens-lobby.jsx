import React from 'react'
import { Sticker, Avatar, hashSeed } from './primitives.jsx'

// components/screens-lobby.jsx — Lobby, countdown

function LobbyScreen({ room, isOwner, onStart, onLeave, onUpdateRules, theme }) {
  const [copied, setCopied] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const allReady = room.players.every(p => p.ready || p.isOwner);
  const canStart = isOwner && room.players.length >= 3 && allReady;

  return (
    <div style={{ minHeight: "100vh", padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <button onClick={onLeave} className="btn btn--ghost btn--sm">← Salir</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sticker color="mustard" rotate={-2} size="lg">Sala · {room.code}</Sticker>
          <button onClick={copyCode} className="btn btn--sm" style={{ padding: "10px 14px" }}>
            {copied ? "✓ Copiado" : "⧉ Copiar"}
          </button>
        </div>
        <div style={{ width: 80 }}/>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 24,
      }} className="lobby-grid">
        {/* LEFT — players */}
        <div className="card" style={{ padding: 28, background: "var(--paper)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <h2 style={h2Style}>Jugadores</h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-soft)" }}>
              {room.players.length} / {room.rules.maxPlayers}
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 16,
          }}>
            {room.players.map(p => (
              <PlayerCard key={p.id} player={p} avatarStyle={theme.avatarStyle}/>
            ))}
            {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="dashed" style={{
                padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                minHeight: 140, justifyContent: "center",
                color: "var(--ink-soft)",
                fontSize: 13,
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  border: "2.5px dashed var(--ink-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, color: "var(--ink-soft)",
                }}>?</div>
                Esperando...
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — rules */}
        <div className="card" style={{ padding: 28, background: "var(--card)", alignSelf: "start" }}>
          <h2 style={h2Style}>Reglas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
            <RuleRow
              label="Tiempo por turno"
              value={`${room.rules.turnTime}s`}
              min={10} max={60} step={5}
              current={room.rules.turnTime}
              editable={isOwner}
              onChange={v => onUpdateRules({ turnTime: v })}
              suffix="s"
            />
            <RuleRow
              label="Rondas antes de votar"
              value={`${room.rules.roundsBeforeVote}`}
              min={1} max={5} step={1}
              current={room.rules.roundsBeforeVote}
              editable={isOwner}
              onChange={v => onUpdateRules({ roundsBeforeVote: v })}
            />
            <RuleRow
              label="Máx. jugadores"
              value={`${room.rules.maxPlayers}`}
              min={4} max={12} step={1}
              current={room.rules.maxPlayers}
              editable={isOwner}
              onChange={v => onUpdateRules({ maxPlayers: v })}
            />
            <ToggleRow
              label="El impostor conoce la pista"
              value={room.rules.imposterHasHint}
              editable={isOwner}
              onChange={v => onUpdateRules({ imposterHasHint: v })}
            />
            <ToggleRow
              label="Impostor gana al no ser descubierto"
              value={room.rules.imposterWinsIfNotFound}
              editable={isOwner}
              onChange={v => onUpdateRules({ imposterWinsIfNotFound: v })}
            />
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "2.5px dashed var(--ink-soft)" }}>
            {isOwner ? (
              <button
                className="btn btn--primary btn--block btn--lg"
                disabled={!canStart}
                onClick={onStart}
              >
                {room.players.length < 3 ? "Faltan jugadores" : !allReady ? "Esperando ready..." : "Empezar partida"}
              </button>
            ) : (
              <button
                className={`btn btn--block btn--lg ${ready ? "btn--teal" : "btn--mustard"}`}
                onClick={() => setReady(r => !r)}
              >
                {ready ? "✓ Listo" : "Marcar listo"}
              </button>
            )}
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", marginTop: 12, marginBottom: 0 }}>
              {isOwner ? "Eres el dueño de la sala" : "Esperando que el dueño empiece"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .lobby-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function PlayerCard({ player, avatarStyle }) {
  return (
    <div style={{
      padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      background: "var(--card)",
      border: "3px solid var(--ink)",
      borderRadius: 16,
      boxShadow: "4px 4px 0 var(--ink)",
      position: "relative",
      transform: `rotate(${(hashSeed(player.name) % 5 - 2) * 0.7}deg)`,
    }} className="pop">
      <Avatar name={player.name} style={avatarStyle} size={64} showCrown={player.isOwner}/>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, textAlign: "center" }}>{player.name}</div>
      {player.isOwner ? (
        <Sticker color="mustard" rotate={0} size="sm">Dueño</Sticker>
      ) : player.ready ? (
        <Sticker color="teal" rotate={0} size="sm">✓ Listo</Sticker>
      ) : (
        <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Esperando...</span>
      )}
    </div>
  );
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
          type="range" min={min} max={max} step={step} value={current}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--red)" }}
        />
      )}
    </div>
  );
}

function ToggleRow({ label, value, editable, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{label}</span>
      <button
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

const h2Style = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  margin: 0,
  letterSpacing: "-0.01em",
};

// === COUNTDOWN ===
function CountdownScreen({ onComplete }) {
  const [n, setN] = React.useState(3);
  React.useEffect(() => {
    if (n === 0) { setTimeout(onComplete, 600); return; }
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);

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
        letterSpacing: "-0.04em",
        lineHeight: 1,
        textShadow: "12px 12px 0 var(--paper)",
      }}>
        {n === 0 ? "¡YA!" : n}
      </div>
    </div>
  );
}

export { LobbyScreen, CountdownScreen }
