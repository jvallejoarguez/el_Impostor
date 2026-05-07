// components/screens-entry.jsx — Home and Join screens

function HomeScreen({ onCreate, onJoin, theme }) {
  const [hover, setHover] = React.useState(null);
  return (
    <div className="screen-wrap" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
      position: "relative",
    }}>
      {/* Floating stickers */}
      <div style={{ position: "absolute", top: "8%", left: "6%", pointerEvents: "none" }}>
        <Sticker color="teal" rotate={-8}>¿Quién es?</Sticker>
      </div>
      <div style={{ position: "absolute", top: "12%", right: "8%", pointerEvents: "none" }}>
        <Sticker color="red" rotate={6}>3–12 jugadores</Sticker>
      </div>
      <div style={{ position: "absolute", bottom: "14%", left: "10%", pointerEvents: "none" }}>
        <Sticker color="mustard" rotate={-5}>Juego de palabras</Sticker>
      </div>
      <div style={{ position: "absolute", bottom: "20%", right: "12%", pointerEvents: "none" }}>
        <Sticker color="ink" rotate={4}>Gratis · Online</Sticker>
      </div>

      <div style={{ marginBottom: 48, position: "relative", zIndex: 2 }}>
        <Logo variant={theme.logoVariant} theme={theme}/>
      </div>

      <p style={{
        fontFamily: "var(--font-ui)",
        fontSize: 18,
        color: "var(--ink-soft)",
        maxWidth: 440,
        textAlign: "center",
        marginTop: 0,
        marginBottom: 40,
      }}>
        Todos reciben una palabra secreta. Uno no la tiene. Descubre al impostor antes de que sea tarde.
      </p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          className="btn btn--primary btn--lg"
          onMouseEnter={() => setHover("create")}
          onMouseLeave={() => setHover(null)}
          onClick={onCreate}
          style={{ transform: hover === "create" ? "translate(-2px,-2px) rotate(-1deg)" : "rotate(-1deg)" }}
        >
          <span style={{ fontSize: 22, marginRight: 8 }}>＋</span> Crear sala
        </button>
        <button
          className="btn btn--mustard btn--lg"
          onMouseEnter={() => setHover("join")}
          onMouseLeave={() => setHover(null)}
          onClick={onJoin}
          style={{ transform: hover === "join" ? "translate(-2px,-2px) rotate(1deg)" : "rotate(1deg)" }}
        >
          <span style={{ fontSize: 22, marginRight: 8 }}>→</span> Unirse a sala
        </button>
      </div>

      <div style={{ marginTop: 32, display: "flex", gap: 16, alignItems: "center", opacity: 0.65, flexWrap: "wrap", justifyContent: "center", transform: "scale(0.85)", transformOrigin: "center top" }}>
        <HowItWorksStep num="1" title="Recibe tu palabra"/>
        <Arrow/>
        <HowItWorksStep num="2" title="Di una palabra relacionada"/>
        <Arrow/>
        <HowItWorksStep num="3" title="Descubre al impostor"/>
      </div>
    </div>
  );
}

function HowItWorksStep({ num, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "var(--ink)", color: "var(--paper)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: 16,
      }}>{num}</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{title}</span>
    </div>
  );
}

function Arrow() {
  return <svg width="32" height="16" viewBox="0 0 32 16"><path d="M 2 8 L 28 8 M 22 2 L 28 8 L 22 14" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// === JOIN SCREEN ===
function JoinScreen({ onBack, onJoin }) {
  const [code, setCode] = React.useState(["", "", "", ""]);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState(false);
  const inputsRef = React.useRef([]);

  const setDigit = (i, val) => {
    const v = val.toUpperCase().slice(-1);
    if (!/[A-Z0-9]/.test(v) && v !== "") return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    setError(false);
    if (v && i < 3) inputsRef.current[i+1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) inputsRef.current[i-1]?.focus();
  };

  const full = code.every(c => c.length === 1);
  const canJoin = full && name.trim().length >= 2;

  const submit = () => {
    if (!canJoin) return;
    onJoin(code.join(""), name.trim());
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <button onClick={onBack} className="btn btn--ghost btn--sm" style={{ position: "absolute", top: 20, left: 20 }}>
        ← Volver
      </button>

      <div className="card slide-up" style={{
        width: "100%", maxWidth: 460,
        padding: "40px 36px",
        background: "var(--paper)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Sticker color="teal" rotate={-3} size="lg">Unirse a sala</Sticker>
        </div>

        <label style={labelStyle}>Tu nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={16}
          placeholder="Ej. Ana"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 24 }}>Código de sala</label>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
          {code.map((d, i) => (
            <input
              key={i}
              ref={el => inputsRef.current[i] = el}
              value={d}
              onChange={e => setDigit(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              maxLength={1}
              style={{
                width: 56, height: 72,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 36,
                fontWeight: 700,
                border: `3px solid ${error ? "var(--red)" : "var(--ink)"}`,
                borderRadius: 14,
                background: "var(--card)",
                boxShadow: "4px 4px 0 var(--ink)",
                outline: "none",
                color: "var(--ink)",
                textTransform: "uppercase",
              }}
            />
          ))}
        </div>

        <button
          className="btn btn--primary btn--block"
          disabled={!canJoin}
          onClick={submit}
          style={{ marginTop: 28 }}
        >
          Entrar a la sala →
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--ink-soft)" }}>
          ¿No tienes código? <button onClick={onBack} style={{ color: "var(--red)", fontWeight: 700, textDecoration: "underline" }}>Crea una sala</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-display)",
  fontSize: 13,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink)",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  fontFamily: "var(--font-ui)",
  fontSize: 18,
  fontWeight: 600,
  border: "3px solid var(--ink)",
  borderRadius: 12,
  background: "var(--card)",
  boxShadow: "4px 4px 0 var(--ink)",
  outline: "none",
  color: "var(--ink)",
};

Object.assign(window, { HomeScreen, JoinScreen });
