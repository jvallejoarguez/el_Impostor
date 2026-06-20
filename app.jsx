// app.jsx — main app with state machine, tweaks, fake players

// Simulated data
const WORD_PAIRS = [
  { secret: "Playa", hint: "Lugar de vacaciones" },
  { secret: "Pizza", hint: "Comida popular" },
  { secret: "Fútbol", hint: "Deporte en equipo" },
  { secret: "Navidad", hint: "Fecha festiva" },
  { secret: "Guitarra", hint: "Instrumento musical" },
  { secret: "León", hint: "Animal salvaje" },
];

const FAKE_NAMES = ["Ana", "Luis", "Mía", "Rafa", "Sofi", "Dani", "Kiko", "Vera"];
const FAKE_WORDS = {
  "Playa": ["Arena", "Mar", "Sol", "Toalla", "Olas", "Cangrejo"],
  "Pizza": ["Queso", "Masa", "Italia", "Horno", "Rebanada", "Tomate"],
  "Fútbol": ["Balón", "Gol", "Cancha", "Arquero", "Equipo", "Estadio"],
  "Navidad": ["Regalo", "Árbol", "Nieve", "Familia", "Luces", "Cena"],
  "Guitarra": ["Cuerda", "Música", "Acorde", "Rock", "Púa", "Canción"],
  "León": ["Melena", "Selva", "Rugido", "Rey", "Cazar", "Sabana"],
};

function makeCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function makeFakePlayers(n) {
  const names = [...FAKE_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map((name, i) => ({
    id: `fake-${i}`,
    name,
    isOwner: false,
    ready: Math.random() > 0.3,
  }));
}

const DEFAULT_RULES = {
  turnTime: 30,
  roundsBeforeVote: 2,
  maxPlayers: 8,
  imposterHasHint: true,
  imposterWinsIfNotFound: true,
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#E63946",
  "logoVariant": "stacked",
  "avatarStyle": "blob",
  "circleLayout": "orbit",
  "revealStyle": "flash",
  "typography": "archivo",
  "dark": false
}/*EDITMODE-END*/;

function App() {
  const [screen, setScreen] = React.useState(() => localStorage.getItem("screen") || "home");
  const [theme, setTheme] = React.useState(TWEAK_DEFAULTS);
  const [showTweaks, setShowTweaks] = React.useState(false);

  // apply theme to document
  React.useEffect(() => {
    document.documentElement.style.setProperty("--red", theme.primaryColor);
    document.documentElement.setAttribute("data-theme", theme.dark ? "dark" : "light");
    const fonts = {
      archivo: ["Archivo Black", "Space Grotesk", "JetBrains Mono"],
      bricolage: ["Bricolage Grotesque", "Space Grotesk", "JetBrains Mono"],
      condensed: ["Anton", "Space Grotesk", "JetBrains Mono"],
      rounded: ["DM Sans", "DM Sans", "JetBrains Mono"],
    };
    const [disp, ui, mono] = fonts[theme.typography] || fonts.archivo;
    document.documentElement.style.setProperty("--font-display", `"${disp}", sans-serif`);
    document.documentElement.style.setProperty("--font-ui", `"${ui}", sans-serif`);
    document.documentElement.style.setProperty("--font-mono", `"${mono}", monospace`);
  }, [theme]);

  React.useEffect(() => { localStorage.setItem("screen", screen); }, [screen]);

  // Tweaks listener
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setShowTweaks(true);
      else if (e.data?.type === "__deactivate_edit_mode") setShowTweaks(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const updateTheme = (patch) => {
    setTheme(prev => {
      const next = { ...prev, ...patch };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
      return next;
    });
  };

  // Room state
  const [room, setRoom] = React.useState(null);
  const [currentPlayer, setCurrentPlayer] = React.useState(null); // {id, name, isOwner}

  const createRoom = () => {
    const name = "Tú";
    const fakePlayers = makeFakePlayers(4);
    const me = { id: "me", name, isOwner: true, ready: true };
    const players = [me, ...fakePlayers];
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    setRoom({
      code: makeCode(),
      players,
      rules: { ...DEFAULT_RULES },
      secretWord: pair.secret,
      hint: pair.hint,
      imposterIdx: Math.floor(Math.random() * players.length),
      currentRound: 0,
    });
    setCurrentPlayer(me);
    setScreen("lobby");
  };

  const joinRoom = (code, name) => {
    const fakePlayers = makeFakePlayers(3);
    const owner = { ...fakePlayers[0], isOwner: true };
    const others = fakePlayers.slice(1);
    const me = { id: "me", name, isOwner: false, ready: false };
    const players = [owner, ...others, me];
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    setRoom({
      code,
      players,
      rules: { ...DEFAULT_RULES },
      secretWord: pair.secret,
      hint: pair.hint,
      imposterIdx: Math.floor(Math.random() * players.length),
      currentRound: 0,
    });
    setCurrentPlayer(me);
    setScreen("lobby");
    // simulate ready-up from others over time
    setTimeout(() => {
      setRoom(r => r ? ({ ...r, players: r.players.map(p => p.id === "me" ? p : { ...p, ready: true }) }) : r);
    }, 800);
  };

  const updateRules = (patch) => setRoom(r => ({ ...r, rules: { ...r.rules, ...patch } }));

  const startGame = () => {
    setScreen("countdown");
  };

  // GAME state
  const [activePlayerIdx, setActivePlayerIdx] = React.useState(0);
  const [words, setWords] = React.useState({});
  const [timer, setTimer] = React.useState({ remaining: 30, total: 30 });
  const [votes, setVotes] = React.useState({});
  const [myVote, setMyVote] = React.useState(null);
  const [betweenVote, setBetweenVote] = React.useState(null);

  const beginRound = () => {
    setActivePlayerIdx(0);
    setWords({});
    setTimer({ remaining: room.rules.turnTime, total: room.rules.turnTime });
    setRoom(r => ({ ...r, currentRound: r.currentRound + 1 }));
    setScreen("gameplay");
  };

  // timer tick for gameplay
  React.useEffect(() => {
    if (screen !== "gameplay") return;
    if (timer.remaining <= 0) {
      // auto-submit empty if player's turn not done
      advanceTurn("...");
      return;
    }
    const t = setTimeout(() => setTimer(tm => ({ ...tm, remaining: tm.remaining - 1 })), 1000);
    return () => clearTimeout(t);
  }, [screen, timer.remaining]);

  // simulate fake player word submissions
  React.useEffect(() => {
    if (screen !== "gameplay" || !room) return;
    const active = room.players[activePlayerIdx];
    if (active.id === "me") return;
    // fake player speaks after 1.5-3 sec
    const delay = 1500 + Math.random() * 1500;
    const t = setTimeout(() => {
      const pool = FAKE_WORDS[room.secretWord] || ["Cosa"];
      const isImp = activePlayerIdx === room.imposterIdx;
      // imposter tries a generic word
      const word = isImp
        ? pool[Math.floor(Math.random() * pool.length)] // could be a guess
        : pool[Math.floor(Math.random() * pool.length)];
      advanceTurn(word);
    }, delay);
    return () => clearTimeout(t);
  }, [screen, activePlayerIdx, room]);

  const advanceTurn = (word) => {
    if (!room) return;
    const currentId = room.players[activePlayerIdx].id;
    setWords(w => ({ ...w, [currentId]: word }));
    const next = activePlayerIdx + 1;
    if (next >= room.players.length) {
      // Let everyone read the final word before showing the next decision screen.
      const LAST_WORD_READ_DELAY_MS = 2500;
      setTimeout(() => {
        if (room.currentRound >= room.rules.roundsBeforeVote) {
          setScreen("voting");
          setMyVote(null);
          setVotes({});
          setTimer({ remaining: 20, total: 20 });
        } else {
          setBetweenVote(null);
          setScreen("between");
        }
      }, LAST_WORD_READ_DELAY_MS);
    } else {
      setActivePlayerIdx(next);
      setTimer({ remaining: room.rules.turnTime, total: room.rules.turnTime });
    }
  };

  const submitMyWord = (word) => advanceTurn(word);

  // voting timer
  React.useEffect(() => {
    if (screen !== "voting") return;
    if (timer.remaining <= 0) {
      confirmVotes();
      return;
    }
    const t = setTimeout(() => setTimer(tm => ({ ...tm, remaining: tm.remaining - 1 })), 1000);
    return () => clearTimeout(t);
  }, [screen, timer.remaining]);

  // simulate fake players voting
  React.useEffect(() => {
    if (screen !== "voting" || !room) return;
    room.players.forEach((p, idx) => {
      if (p.id === "me") return;
      const delay = 1500 + Math.random() * 6000;
      setTimeout(() => {
        // bias: 40% vote imposter, 60% someone random
        const guess = Math.random() < 0.4
          ? room.players[room.imposterIdx].id
          : room.players[Math.floor(Math.random() * room.players.length)].id;
        setVotes(v => ({ ...v, [p.id]: guess }));
      }, delay);
    });
  }, [screen, room]);

  const confirmVotes = () => {
    if (!room) return;
    const tally = {};
    Object.values({ ...votes, ...(myVote ? { me: myVote } : {}) }).forEach(id => {
      tally[id] = (tally[id] || 0) + 1;
    });
    const topId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const imposterId = room.players[room.imposterIdx].id;
    const found = topId === imposterId;
    setRoom(r => ({ ...r, _result: { found, tally } }));
    setScreen("results");
  };

  // between-round votes (fake players)
  React.useEffect(() => {
    if (screen !== "between" || !room) return;
    setBetweenVote({ continue: [], vote: [] });
    room.players.forEach(p => {
      if (p.id === "me") return;
      const delay = 800 + Math.random() * 2500;
      const choice = Math.random() > 0.4 ? "continue" : "vote";
      setTimeout(() => {
        setBetweenVote(bv => {
          if (!bv) return bv;
          const next = { continue: [...bv.continue], vote: [...bv.vote] };
          next[choice] = [...next[choice], p.id];
          return next;
        });
      }, delay);
    });
  }, [screen]);

  const [myBetweenVote, setMyBetweenVote] = React.useState(null);
  const castBetween = (c) => {
    setMyBetweenVote(c);
    setBetweenVote(bv => {
      const next = { continue: bv.continue.filter(x => x !== "me"), vote: bv.vote.filter(x => x !== "me") };
      next[c] = [...next[c], "me"];
      // check if all voted
      const total = next.continue.length + next.vote.length;
      if (total >= room.players.length) {
        setTimeout(() => {
          if (next.vote.length > next.continue.length) {
            setScreen("voting");
            setMyVote(null);
            setVotes({});
            setTimer({ remaining: 20, total: 20 });
          } else {
            beginRound();
          }
        }, 1200);
      }
      return next;
    });
  };

  const playAgain = () => {
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    setRoom(r => ({
      ...r,
      secretWord: pair.secret,
      hint: pair.hint,
      imposterIdx: Math.floor(Math.random() * r.players.length),
      currentRound: 0,
      _result: null,
    }));
    setWords({});
    setVotes({});
    setMyVote(null);
    setScreen("countdown");
  };

  const backToLobby = () => {
    setRoom(r => ({ ...r, currentRound: 0, _result: null }));
    setWords({});
    setVotes({});
    setMyVote(null);
    setScreen("lobby");
  };

  // RENDER
  let content;
  if (!room || screen === "home") {
    content = <HomeScreen onCreate={createRoom} onJoin={() => setScreen("join")} theme={theme}/>;
  } else if (screen === "join") {
    content = <JoinScreen onBack={() => setScreen("home")} onJoin={joinRoom}/>;
  } else if (screen === "lobby") {
    content = <LobbyScreen
      room={room} isOwner={currentPlayer?.isOwner}
      onStart={startGame}
      onLeave={() => { setRoom(null); setScreen("home"); }}
      onUpdateRules={updateRules}
      theme={theme}
    />;
  } else if (screen === "countdown") {
    content = <CountdownScreen onComplete={() => setScreen("reveal")}/>;
  } else if (screen === "reveal") {
    const myIdx = room.players.findIndex(p => p.id === currentPlayer.id);
    const isImp = myIdx === room.imposterIdx;
    content = <RoleRevealScreen
      isImposter={isImp}
      secretWord={room.secretWord}
      hint={room.hint}
      onContinue={beginRound}
      revealStyle={theme.revealStyle}
    />;
  } else if (screen === "gameplay") {
    const myIdx = room.players.findIndex(p => p.id === currentPlayer.id);
    const amImp = myIdx === room.imposterIdx;
    content = <GameplayScreen
      room={{ ...room, imposterIdx: room.imposterIdx }}
      currentPlayerIdx={myIdx}
      activePlayerIdx={activePlayerIdx}
      currentWord={amImp ? room.hint : room.secretWord}
      words={words}
      timer={timer}
      onSubmitWord={submitMyWord}
      circleLayout={theme.circleLayout}
      theme={theme}
    />;
  } else if (screen === "between") {
    const bv = betweenVote || { continue: [], vote: [] };
    content = <BetweenRoundScreen
      room={room}
      votesToContinue={bv.continue.length}
      votesToVote={bv.vote.length}
      onVote={castBetween}
      myVote={myBetweenVote}
    />;
  } else if (screen === "voting") {
    content = <VotingScreen
      room={{ ...room, players: room.players.map((p, i) => ({ ...p, isImposter: i === room.imposterIdx })) }}
      myVote={myVote}
      votes={votes}
      onVote={setMyVote}
      onConfirm={confirmVotes}
      timer={timer.remaining}
      avatarStyle={theme.avatarStyle}
    />;
  } else if (screen === "results") {
    const imposter = room.players[room.imposterIdx];
    const tally = room._result?.tally || {};
    content = <ResultsScreen
      room={{ ...room, players: room.players.map((p, i) => ({ ...p, isImposter: i === room.imposterIdx })) }}
      imposterFound={room._result?.found}
      imposter={imposter}
      secretWord={room.secretWord}
      voteTally={tally}
      onPlayAgain={playAgain}
      onBackToLobby={backToLobby}
      avatarStyle={theme.avatarStyle}
    />;
  }

  return (
    <>
      {content}
      {showTweaks && <TweaksPanel theme={theme} onChange={updateTheme}/>}
      <DevScreenJumper current={screen} onJump={(s) => {
        if (!room) createRoom();
        setTimeout(() => setScreen(s), 50);
      }}/>
    </>
  );
}

function DevScreenJumper({ current, onJump }) {
  const [open, setOpen] = React.useState(false);
  const screens = ["home", "join", "lobby", "countdown", "reveal", "gameplay", "between", "voting", "results"];
  return (
    <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 99 }}>
      {open && (
        <div style={{
          marginBottom: 8,
          padding: 12,
          background: "var(--ink)", color: "var(--paper)",
          border: "2px solid var(--paper)",
          borderRadius: 12,
          display: "flex", flexDirection: "column", gap: 6,
          fontFamily: "var(--font-mono)", fontSize: 12,
        }}>
          <div style={{ opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}>Saltar pantalla</div>
          {screens.map(s => (
            <button key={s} onClick={() => onJump(s)} style={{
              padding: "4px 10px", background: current === s ? "var(--mustard)" : "transparent",
              color: current === s ? "var(--ink)" : "var(--paper)",
              border: "1px solid currentColor", borderRadius: 6,
              textAlign: "left", fontFamily: "inherit", fontSize: 12,
            }}>{s}</button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} style={{
        padding: "8px 12px",
        background: "var(--ink)", color: "var(--paper)",
        border: "2px solid var(--paper)", borderRadius: 10,
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        opacity: 0.6,
      }}>{open ? "✕" : "◎"} dev</button>
    </div>
  );
}

function TweaksPanel({ theme, onChange }) {
  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 100,
      width: 280,
      background: "var(--paper)",
      border: "3px solid var(--ink)",
      borderRadius: 16,
      boxShadow: "6px 6px 0 var(--ink)",
      padding: 16,
      maxHeight: "80vh", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.05em" }}>TWEAKS</div>
      </div>
      <TweakField label="Color primario">
        <div style={{ display: "flex", gap: 6 }}>
          {["#E63946", "#3DA5A0", "#F4B942", "#B5A7E6", "#1A1410"].map(c => (
            <button key={c} onClick={() => onChange({ primaryColor: c })} style={{
              width: 28, height: 28, borderRadius: 8,
              background: c, border: `3px solid ${theme.primaryColor === c ? "var(--ink)" : "transparent"}`,
              boxShadow: "2px 2px 0 var(--ink)",
            }}/>
          ))}
        </div>
      </TweakField>
      <TweakField label="Logo">
        <Segmented value={theme.logoVariant} options={[["stacked","Apilado"],["sticker","Sticker"],["badge","Insignia"]]} onChange={v => onChange({ logoVariant: v })}/>
      </TweakField>
      <TweakField label="Avatares">
        <Segmented value={theme.avatarStyle} options={[["blob","Blob"],["initials","Iniciales"],["animal","Animales"]]} onChange={v => onChange({ avatarStyle: v })}/>
      </TweakField>
      <TweakField label="Círculo de juego">
        <Segmented value={theme.circleLayout} options={[["orbit","Órbita"],["stage","Escenario"]]} onChange={v => onChange({ circleLayout: v })}/>
      </TweakField>
      <TweakField label="Reveal de rol">
        <Segmented value={theme.revealStyle} options={[["flash","Flash"],["card","Tarjeta"],["stamp","Sello"]]} onChange={v => onChange({ revealStyle: v })}/>
      </TweakField>
      <TweakField label="Tipografía">
        <Segmented value={theme.typography} options={[["archivo","Archivo"],["bricolage","Bricolage"],["condensed","Condensada"],["rounded","Redondeada"]]} onChange={v => onChange({ typography: v })}/>
      </TweakField>
      <TweakField label="Modo">
        <Segmented value={theme.dark ? "dark" : "light"} options={[["light","Claro"],["dark","Oscuro"]]} onChange={v => onChange({ dark: v === "dark" })}/>
      </TweakField>
    </div>
  );
}

function TweakField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 4,
      padding: 3,
      background: "var(--cream-deep)",
      border: "2px solid var(--ink)",
      borderRadius: 10,
    }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, minWidth: 60,
          padding: "6px 8px",
          background: value === v ? "var(--ink)" : "transparent",
          color: value === v ? "var(--paper)" : "var(--ink)",
          borderRadius: 7,
          fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 700,
          border: "none",
        }}>{label}</button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
