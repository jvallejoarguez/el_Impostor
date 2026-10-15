import React from 'react'
import { ClubAvatar } from './club-avatars.jsx'

// components/primitives.jsx — Logo, Avatar, shared bits

function useIsMobile(maxWidth = 640) {
  const get = () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  const [m, setM] = React.useState(get);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = e => setM(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [maxWidth]);
  return m;
}

// === LOGO ===
// A yellow "EL" tag on a chunky outlined "IMPOSTOR"; the O wears a domino mask.
function Logo({ size = 1 }) {
  return (
    <div className="logo" style={{ fontSize: 112 * size }}>
      <span className="logo-el">EL</span>
      <span className="logo-word">
        IMP
        <span className="logo-o">O<svg viewBox="0 0 44 18" aria-hidden="true">
          <path d="M2 7q9-7 20 0q11-7 20 0q0 10-9 10q-6 0-11-5q-5 5-11 5q-9 0-9-10Z" fill="#1C0B40" stroke="#fff" strokeWidth="2"/>
          <circle cx="12" cy="9" r="3.4" fill="#fff"/><circle cx="32" cy="9" r="3.4" fill="#fff"/>
        </svg></span>
        STOR
      </span>
    </div>
  );
}

// === AVATAR ===
function Avatar({ name, avatarId, size = 72, speaking = false, eliminated = false, showCrown = false }) {
  return <ClubAvatar name={name} character={avatarId} size={size} speaking={speaking} eliminated={eliminated} showCrown={showCrown}/>;
}

// === STICKER / CHIP ===
const STICKER_COLORS = { mustard: ['var(--mustard)', 'var(--ink)'], red: ['var(--red)', 'var(--paper)'], teal: ['var(--teal)', 'var(--ink)'], ink: ['var(--ink)', 'var(--mustard)'] };
function Sticker({ children, color = "mustard", rotate = -3, size = "md" }) {
  const [bg, fg] = STICKER_COLORS[color] || STICKER_COLORS.mustard;
  return (
    <span style={{
      display: "inline-block",
      padding: size === "lg" ? "8px 20px" : "4px 14px",
      background: bg, color: fg,
      border: "3px solid var(--ink)",
      borderRadius: 999,
      fontFamily: "var(--font-display)",
      fontSize: size === "lg" ? 24 : size === "sm" ? 14 : 18,
      boxShadow: "0 4px 0 var(--ink)",
      transform: `rotate(${rotate}deg)`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}


export { Logo, Avatar, Sticker, useIsMobile }
