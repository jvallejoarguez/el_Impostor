import React from 'react'

// components/primitives.jsx — Logo, Avatar, shared bits

// === LOGO VARIANTS ===
// variant: 'stacked' | 'badge' | 'sticker'
function Logo({ variant = "stacked", size = 1, theme = {} }) {
  const primary = theme.primary || "var(--red)";
  if (variant === "badge") {
    const d = 180 * size;
    return (
      <div style={{ width: d, height: d, position: "relative" }}>
        <svg viewBox="0 0 180 180" width={d} height={d}>
          <circle cx="90" cy="90" r="84" fill={primary} stroke="var(--ink)" strokeWidth="4"/>
          <circle cx="90" cy="90" r="74" fill="none" stroke="var(--paper)" strokeWidth="2" strokeDasharray="3 4"/>
          <path id="top" d="M 90,90 m -58,0 a 58,58 0 1,1 116,0" fill="none"/>
          <path id="bot" d="M 90,90 m -58,0 a 58,58 0 1,0 116,0" fill="none"/>
          <text fontFamily="Archivo Black, sans-serif" fontSize="18" fill="var(--paper)" letterSpacing="4">
            <textPath href="#top" startOffset="50%" textAnchor="middle">EL · IMPOSTOR · JUEGO</textPath>
          </text>
          <text fontFamily="Archivo Black, sans-serif" fontSize="13" fill="var(--paper)" letterSpacing="6">
            <textPath href="#bot" startOffset="50%" textAnchor="middle">¿QUIÉN ES? · ¿QUIÉN ES?</textPath>
          </text>
          {/* mask face in center */}
          <g transform="translate(90,92)">
            <ellipse cx="0" cy="0" rx="26" ry="18" fill="var(--ink)"/>
            <circle cx="-10" cy="-2" r="5" fill="var(--paper)"/>
            <circle cx="10" cy="-2" r="5" fill="var(--paper)"/>
            <circle cx="-10" cy="-1" r="2" fill="var(--ink)"/>
            <circle cx="10" cy="-1" r="2" fill="var(--ink)"/>
          </g>
        </svg>
      </div>
    );
  }
  if (variant === "sticker") {
    return (
      <div style={{ display: "inline-block", transform: `scale(${size})`, transformOrigin: "top left" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", filter: "drop-shadow(6px 6px 0 var(--ink))" }}>
          {"IMPOSTOR".split("").map((ch, i) => (
            <span key={i} style={{
              display: "inline-block",
              padding: "6px 10px",
              background: i % 2 === 0 ? primary : "var(--mustard)",
              color: i % 2 === 0 ? "var(--paper)" : "var(--ink)",
              border: "3px solid var(--ink)",
              borderRadius: 8,
              fontFamily: "var(--font-display)",
              fontSize: 48,
              lineHeight: 1,
              transform: `rotate(${(i % 2 ? -1 : 1) * (2 + i % 3)}deg)`,
            }}>{ch}</span>
          ))}
        </div>
      </div>
    );
  }
  // stacked (default) — "EL" small, "IMPOSTOR" big, masked O
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      transform: `scale(${size})`, transformOrigin: "center top",
      lineHeight: 0.85,
    }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 48,
        color: "var(--ink)",
        letterSpacing: "0.15em",
        padding: "4px 16px",
        background: "var(--mustard)",
        border: "3px solid var(--ink)",
        borderRadius: 10,
        boxShadow: "4px 4px 0 var(--ink)",
        transform: "rotate(-2deg)",
        marginBottom: -8,
        zIndex: 2,
        position: "relative",
      }}>EL</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 112,
        color: primary,
        letterSpacing: "-0.02em",
        WebkitTextStroke: "3px var(--ink)",
        filter: "drop-shadow(6px 6px 0 var(--ink))",
        display: "flex",
        alignItems: "center",
      }}>
        <span>IMP</span>
        {/* O with mask face overlay */}
        <span style={{ position: "relative", display: "inline-block", margin: "0 0.01em" }}>
          O
          {/* small domino mask sticker on top */}
          <span style={{
            position: "absolute",
            top: "30%", left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 3,
            background: "var(--ink)",
            borderRadius: 4,
            padding: "2px 4px",
            border: "2px solid var(--paper)",
            pointerEvents: "none",
          }}>
            <svg viewBox="0 0 44 18" width="0.38em" height="0.16em" style={{ display: "block", minWidth: 28, minHeight: 11 }}>
              <ellipse cx="11" cy="9" rx="9" ry="7" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2"/>
              <circle cx="11" cy="9" r="3.5" fill="var(--paper)"/>
              <circle cx="11" cy="9" r="1.5" fill="var(--ink)"/>
              <ellipse cx="33" cy="9" rx="9" ry="7" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2"/>
              <circle cx="33" cy="9" r="3.5" fill="var(--paper)"/>
              <circle cx="33" cy="9" r="1.5" fill="var(--ink)"/>
              <rect x="20" y="7" width="4" height="4" fill="var(--ink)" stroke="var(--paper)" strokeWidth="1"/>
            </svg>
          </span>
        </span>
        <span>STOR</span>
      </div>
    </div>
  );
}

// === AVATAR ===
// deterministic generator based on seed (name).
// styles: 'blob' | 'initials' | 'animal'
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const AVATAR_COLORS = ["#F4B942", "#3DA5A0", "#E63946", "#B5A7E6", "#F5A3B8", "#7FB069", "#F07438", "#4A90E2"];
const ANIMALS = ["🦊","🐻","🐼","🐸","🦉","🐺","🦁","🐨","🦄","🐵","🐙","🐢"];

function Avatar({ name, style = "blob", size = 72, speaking = false, eliminated = false, showCrown = false }) {
  const seed = hashSeed(name || "X");
  const color = AVATAR_COLORS[seed % AVATAR_COLORS.length];
  const shape = seed % 3; // 0 circle, 1 squircle, 2 hex
  const mouth = (seed >> 3) % 4; // 0 smile, 1 o, 2 line, 3 zigzag
  const eyes = (seed >> 5) % 3; // 0 dots, 1 lines, 2 stars

  const wrapperStyle = {
    width: size, height: size,
    position: "relative",
    display: "inline-block",
    filter: eliminated ? "grayscale(1) opacity(0.4)" : "none",
  };

  const shadowEl = (
    <div style={{
      position: "absolute", left: 4, top: 4, width: size, height: size,
      background: "var(--ink)",
      borderRadius: shape === 0 ? "50%" : shape === 1 ? "30%" : "18%",
      zIndex: 0,
      clipPath: shape === 2 ? "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)" : "none",
    }}/>
  );

  if (style === "initials") {
    const initials = (name || "?").split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();
    return (
      <div style={wrapperStyle}>
        {shadowEl}
        <div style={{
          position: "relative",
          width: size, height: size,
          background: color,
          border: "3px solid var(--ink)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontSize: size * 0.38,
          color: "var(--ink)",
          zIndex: 1,
          animation: speaking ? "bob 0.8s ease-in-out infinite" : "none",
          boxShadow: speaking ? "0 0 0 4px var(--mustard), 0 0 0 7px var(--ink)" : "none",
        }}>{initials}</div>
        {showCrown && <Crown size={size}/>}
      </div>
    );
  }

  if (style === "animal") {
    const animal = ANIMALS[seed % ANIMALS.length];
    return (
      <div style={wrapperStyle}>
        {shadowEl}
        <div style={{
          position: "relative",
          width: size, height: size,
          background: color,
          border: "3px solid var(--ink)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.55,
          zIndex: 1,
          animation: speaking ? "bob 0.8s ease-in-out infinite" : "none",
          boxShadow: speaking ? "0 0 0 4px var(--mustard), 0 0 0 7px var(--ink)" : "none",
        }}>{animal}</div>
        {showCrown && <Crown size={size}/>}
      </div>
    );
  }

  // blob
  const faceClip = shape === 2 ? "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)" : "none";
  const faceRadius = shape === 0 ? "50%" : shape === 1 ? "30%" : "18%";

  const renderMouth = () => {
    const mw = size * 0.35, mh = size * 0.14;
    const cx = size / 2, cy = size * 0.65;
    switch (mouth) {
      case 0: return <path d={`M ${cx-mw/2} ${cy} Q ${cx} ${cy+mh} ${cx+mw/2} ${cy}`} stroke="var(--ink)" strokeWidth={size*0.05} fill="none" strokeLinecap="round"/>;
      case 1: return <ellipse cx={cx} cy={cy+mh/3} rx={mw/3} ry={mh/2} fill="var(--ink)"/>;
      case 2: return <line x1={cx-mw/2} y1={cy+mh/3} x2={cx+mw/2} y2={cy+mh/3} stroke="var(--ink)" strokeWidth={size*0.05} strokeLinecap="round"/>;
      case 3: return <path d={`M ${cx-mw/2} ${cy+mh/3} l ${mw/4} -${mh/3} l ${mw/4} ${mh/3} l ${mw/4} -${mh/3}`} stroke="var(--ink)" strokeWidth={size*0.04} fill="none"/>;
    }
  };

  const renderEyes = () => {
    const ey = size * 0.42;
    const er = size * 0.065;
    const lex = size * 0.35, rex = size * 0.65;
    if (eyes === 1) {
      return <>
        <line x1={lex-er} y1={ey} x2={lex+er} y2={ey} stroke="var(--ink)" strokeWidth={size*0.05} strokeLinecap="round"/>
        <line x1={rex-er} y1={ey} x2={rex+er} y2={ey} stroke="var(--ink)" strokeWidth={size*0.05} strokeLinecap="round"/>
      </>;
    }
    return <>
      <circle cx={lex} cy={ey} r={er} fill="var(--ink)"/>
      <circle cx={rex} cy={ey} r={er} fill="var(--ink)"/>
      <circle cx={lex+er*0.3} cy={ey-er*0.3} r={er*0.3} fill="var(--paper)"/>
      <circle cx={rex+er*0.3} cy={ey-er*0.3} r={er*0.3} fill="var(--paper)"/>
    </>;
  };

  return (
    <div style={wrapperStyle}>
      {shadowEl}
      <div style={{
        position: "relative",
        width: size, height: size,
        background: color,
        border: "3px solid var(--ink)",
        borderRadius: faceRadius,
        clipPath: faceClip,
        zIndex: 1,
        animation: speaking ? "bob 0.8s ease-in-out infinite" : "none",
        boxShadow: speaking ? "0 0 0 4px var(--mustard), 0 0 0 7px var(--ink)" : "none",
      }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: "absolute", inset: 0 }}>
          {renderEyes()}
          {renderMouth()}
          {/* cheeks */}
          <circle cx={size*0.22} cy={size*0.6} r={size*0.06} fill="var(--ink)" opacity="0.15"/>
          <circle cx={size*0.78} cy={size*0.6} r={size*0.06} fill="var(--ink)" opacity="0.15"/>
        </svg>
      </div>
      {showCrown && <Crown size={size}/>}
    </div>
  );
}

function Crown({ size }) {
  return (
    <svg viewBox="0 0 100 50" width={size * 0.6} height={size * 0.3}
      style={{ position: "absolute", top: -size*0.25, left: size*0.2, zIndex: 3, filter: "drop-shadow(2px 2px 0 var(--ink))" }}>
      <path d="M 10 40 L 20 10 L 35 30 L 50 5 L 65 30 L 80 10 L 90 40 Z"
        fill="var(--mustard)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round"/>
      <circle cx="50" cy="20" r="4" fill="var(--red)" stroke="var(--ink)" strokeWidth="2"/>
    </svg>
  );
}

// === STICKER / BADGE ===
function Sticker({ children, color = "mustard", rotate = -3, size = "md" }) {
  const bg = color === "red" ? "var(--red)" : color === "teal" ? "var(--teal)" : color === "ink" ? "var(--ink)" : "var(--mustard)";
  const fg = color === "red" || color === "teal" || color === "ink" ? "var(--paper)" : "var(--ink)";
  const fs = size === "lg" ? 18 : size === "sm" ? 11 : 13;
  return (
    <span style={{
      display: "inline-block",
      padding: size === "lg" ? "10px 18px" : "5px 12px",
      background: bg, color: fg,
      border: "2.5px solid var(--ink)",
      borderRadius: 999,
      fontFamily: "var(--font-display)",
      fontSize: fs,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      boxShadow: "3px 3px 0 var(--ink)",
      transform: `rotate(${rotate}deg)`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}


export { Logo, Avatar, Crown, Sticker, hashSeed, AVATAR_COLORS }
