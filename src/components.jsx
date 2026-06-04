// components.jsx — shared UI primitives for Pill Tracker
import React from "react";
import { PILL_IMG, colorFor, inkFor, medFill, medDoses, medTakenCount } from "./data.jsx";
import { PooledPill } from "./pill3d.jsx";

const { useState, useRef, useEffect } = React;

// ── Icons ────────────────────────────────────────────────────────────
function Icon({ name, size = 24, color = "#000", strokeWidth = 2, style = {} }) {
  const p = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    expand:   <><path d="M7 17L17 7" {...p}/><path d="M8 7h9v9" {...p}/></>,
    back:     <><path d="M15 19l-7-7 7-7" {...p}/></>,
    plus:     <><path d="M12 5v14M5 12h14" {...p}/></>,
    check:    <><path d="M5 12.5l4.5 4.5L19 7" {...p}/></>,
    camera:   <><path d="M3 8.5A2.5 2.5 0 015.5 6h1.2a1 1 0 00.83-.45l.94-1.4A1 1 0 019.3 3.7h5.4a1 1 0 01.83.45l.94 1.4a1 1 0 00.83.45h1.2A2.5 2.5 0 0121 8.5v9A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-9z" {...p}/><circle cx="12" cy="13" r="3.6" {...p}/></>,
    photos:   <><rect x="3" y="5" width="18" height="14" rx="2.5" {...p}/><circle cx="8.5" cy="10" r="1.6" {...p}/><path d="M5 17l4.5-4.5L13 16l2.5-2.5L19 17" {...p}/></>,
    close:    <><path d="M6 6l12 12M18 6L6 18" {...p}/></>,
    clock:    <><circle cx="12" cy="12" r="8.5" {...p}/><path d="M12 7.5V12l3 2" {...p}/></>,
    trash:    <><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7" {...p}/><path d="M10 11v6M14 11v6" {...p}/></>,
    history:  <><path d="M3.5 12a8.5 8.5 0 109-8.48" {...p}/><path d="M3.5 5.5V9H7" {...p}/><path d="M12 7.5V12l3 1.8" {...p}/></>,
    bell:     <><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" {...p}/><path d="M10 20a2 2 0 004 0" {...p}/></>,
    sun:      <><circle cx="12" cy="12" r="4.2" {...p}/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" {...p}/></>,
    sunset:   <><path d="M3 18h18M6 18a6 6 0 0112 0" {...p}/><path d="M12 3.5v4M5 8.5l1.4 1.4M19 8.5l-1.4 1.4M2.5 14h2M19.5 14h2" {...p}/></>,
    moon:     <><path d="M20 13.5A8 8 0 1110.5 4a6.3 6.3 0 009.5 9.5z" {...p}/></>,
    share:    <><path d="M12 15V4M12 4L8 8M12 4l4 4" {...p}/><path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" {...p}/></>,
    edit:     <><path d="M4 20h4l10-10-4-4L4 16v4z" {...p}/><path d="M13.5 6.5l4 4" {...p}/></>,
    link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" {...p}/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" {...p}/></>,
    message:  <><path d="M21 11.5a8.4 8.4 0 01-9 8.5 9 9 0 01-3.9-.9L3 20l1.4-4.2A8.4 8.4 0 1121 11.5z" {...p}/></>,
    mail:     <><rect x="3" y="5" width="18" height="14" rx="2.5" {...p}/><path d="M4 7l8 6 8-6" {...p}/></>,
    spark:    <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" {...p}/></>,
    flip:     <><path d="M17 7L7 17" {...p}/><path d="M16 17H7V8" {...p}/></>,
    settings: <><circle cx="12" cy="12" r="3.1" {...p}/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" {...p}/></>,
    minus:    <><path d="M5 12h14" {...p}/></>,
    chevron:  <><path d="M9 6l6 6-6 6" {...p}/></>,
    send:     <><path d="M22 2L11 13" {...p}/><path d="M22 2l-7 20-4-9-9-4 20-7z" {...p}/></>,
    report:   <><rect x="5" y="3" width="14" height="18" rx="2.5" {...p}/><path d="M9 8h6M9 12h6M9 16h4" {...p}/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// ── Dots: one per pill due today. Filled = TAKEN, hollow = still to take. ──
function DotRow({ total, takenCount, size = 13, gap = 7, color = "#0A0A0A", line = "rgba(10,10,10,0.45)" }) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    const filled = i < takenCount; // filled once taken
    dots.push(
      <span key={i} style={{
        width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
        background: filled ? color : "transparent",
        border: filled ? "none" : `2px solid ${line}`,
        boxSizing: "border-box",
        transition: "background .35s ease, border-color .35s ease",
      }} />
    );
  }
  return <div style={{ display: "flex", gap, alignItems: "center" }}>{dots}</div>;
}

// ── Caretaker avatar: a colored initial-circle ────────────────────────
function Avatar({ ct, size = 26, border = "#fff" }) {
  return (
    <div title={ct.name} style={{
      width: size, height: size, borderRadius: "50%", flex: "0 0 auto", boxSizing: "border-box",
      background: `hsl(${ct.hue} 52% 56%)`, border: `1.5px solid ${border}`,
      display: "grid", placeItems: "center", color: "#fff",
      fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: Math.round(size * 0.42),
    }}>{(ct.name || "?").charAt(0).toUpperCase()}</div>
  );
}

// ── Avatar stack: who's tracking this person + a "+" to share/invite ──
function AvatarStack({ caretakers = [], onAdd, iconColor = "#0A0A0A", borderColor = "#fff" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {caretakers.length > 0 && (
        <div style={{ display: "flex" }}>
          {caretakers.slice(0, 4).map((ct, i) => (
            <div key={ct.id} style={{ marginLeft: i ? -8 : 0 }}>
              <Avatar ct={ct} border={borderColor} />
            </div>
          ))}
        </div>
      )}
      <button onClick={(e) => { e.stopPropagation(); onAdd && onAdd(); }} aria-label="Share with a caretaker"
        style={{
          width: 24, height: 24, borderRadius: "50%", border: `1.5px dashed ${iconColor}`,
          background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", opacity: 0.7, padding: 0,
        }}>
        <Icon name="plus" size={14} strokeWidth={2.6} color={iconColor} />
      </button>
    </div>
  );
}

// ── Floating pill renders with soft shadow + bob/rotate animation ──────
function PillStack({ meds, speed = 1, big = true, onTake }) {
  const shown = meds.slice(0, 3);
  const sizes = { capsule: big ? 150 : 96, oval: big ? 92 : 60, tablet: big ? 78 : 52 };
  const baseDur = 4.2; // seconds at speed=1
  const dur = speed > 0 ? baseDur / speed : 9999;
  return (
    <div style={{ position: "relative", height: big ? 132 : 88, width: "100%" }}>
      {/* shared soft ground shadow */}
      <div style={{
        position: "absolute", left: "50%", bottom: big ? 6 : 4, transform: "translateX(-50%)",
        width: "78%", height: big ? 34 : 22, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0) 70%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", gap: big ? 2 : 0,
      }}>
        {shown.map((m, i) => {
          const w = sizes[m.pill] || sizes.tablet;
          const rot = [-14, 4, 12][i] ?? 0;
          return (
            <button key={m.id} onClick={(e) => { e.stopPropagation(); onTake && onTake(m.id); }}
              title={m.taken ? `${m.name} — taken` : `Tap once you've taken ${m.name}`}
              style={{
                border: "none", background: "transparent", cursor: onTake ? "pointer" : "default",
                padding: 0, margin: big ? "0 -6px" : "0 -10px", position: "relative",
                animation: `pillFloat ${dur}s ease-in-out ${i * 0.5}s infinite`,
                opacity: m.taken ? 0.34 : 1,
                filter: m.taken ? "grayscale(0.7)" : "none",
                transition: "opacity .4s ease, filter .4s ease",
                transform: `rotate(${rot}deg)`,
              }}>
              <img src={PILL_IMG[m.pill]} alt={m.name} draggable="false" style={{
                width: w, height: "auto", display: "block",
                filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.18))", pointerEvents: "none",
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Take / Taken badge ────────────────────────────────────────────────
function Badge({ taken, ink, onClick }) {
  const light = ink && ink.mode === "light"; // light text → dark card bg
  const idleBg = light ? "rgba(255,255,255,0.16)" : "rgba(10,10,10,0.07)";
  const idleText = light ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.62)";
  const idleDot = light ? "rgba(255,255,255,0.28)" : "rgba(10,10,10,0.16)";
  const idleCheck = light ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.55)";
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
      padding: "7px 11px 7px 9px", borderRadius: 8, border: "none",
      fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 15.5, fontWeight: 700,
      background: taken ? "#34C759" : idleBg,
      color: taken ? "#fff" : idleText,
      transition: "all .2s ease", whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center",
        background: taken ? "rgba(255,255,255,0.28)" : idleDot,
      }}>
        <Icon name="check" size={12} color={taken ? "#fff" : idleCheck} strokeWidth={2.6} />
      </span>
      {taken ? "Taken" : "Take"}
    </button>
  );
}

// ── A single card pill: transparent spinning glass (not taken). Tapping it
//    pours the liquid in (fills) and it stays a live, spinning 3D pill. ──────
function CardPill({ med, speed, onToggle, darkCard = false, burst = false, cellH = 116 }) {
  const fill = medFill(med);

  return (
    <div style={{ position: "relative", flex: "1 1 0", minWidth: 64, maxWidth: 150, height: cellH }}>
      {/* subtle contact shadow only — no halo behind the pill */}
      <div style={{
        position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)",
        width: "52%", height: 11, borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(ellipse at center, rgba(0,0,0,${darkCard ? 0.28 : 0.14}) 0%, rgba(0,0,0,0) 72%)`,
      }} />
      <PooledPill geo={med.geo} color={med.c3d} imprint={med.imprint} fill={fill}
        spin={speed > 0} spinSpeed={30 * speed} burst={burst}
        style={{ opacity: 0.5 + 0.5 * fill, transition: "opacity .35s ease" }}
        onToggle={onToggle ? (() => onToggle(med.id)) : undefined} />
      {burst && <SparkleBurst />}
    </div>
  );
}

// ── Sparkle burst (Mario power-moon style) ────────────────────────────
function SparkleBurst() {
  const sparks = 10;
  const colors = ["#FCC560", "#FFFFFF", "#FFE9A8", "#FFD24A"];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3, overflow: "visible" }}>
      <div style={{ position: "absolute", left: "50%", top: "47%", width: 0, height: 0 }}>
        {Array.from({ length: sparks }).map((_, i) => {
          const ang = (i / sparks) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 34 + Math.random() * 30;
          const sz = 5 + Math.random() * 6;
          const delay = Math.random() * 0.08;
          return (
            <span key={i} style={{
              position: "absolute", width: sz, height: sz, left: -sz / 2, top: -sz / 2,
              background: colors[i % colors.length], borderRadius: 1,
              transform: "rotate(45deg)",
              boxShadow: `0 0 ${sz}px ${sz / 2}px rgba(255,221,120,0.6)`,
              animation: `sparkleOut .72s ease-out ${delay}s both`,
              ["--tx"]: `${Math.cos(ang) * dist}px`,
              ["--ty"]: `${Math.sin(ang) * dist}px`,
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Frosted sticky screen header (shared pattern across all screens) ──
//    Sits at the top of a scroll area, blurs whatever scrolls under it, and
//    clears the status bar / dynamic island via paddingTop.
function ScreenHeader({ theme, children }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50, paddingTop: 56,
      background: theme.appBgBlur,
      backdropFilter: "blur(18px) saturate(150%)",
      WebkitBackdropFilter: "blur(18px) saturate(150%)",
    }}>
      {children}
    </div>
  );
}

// ── Person card (home list item & detail header) ──────────────────────
function PersonCard({ person, speed, onOpen, onTakePill, onAddCaretaker, compact = false, burstMedId }) {
  const c = colorFor(person.color);
  const ink = inkFor(person.color);
  const total = person.meds.reduce((n, m) => n + medDoses(m).length, 0);
  const takenCount = person.meds.reduce((n, m) => n + medTakenCount(m), 0);
  const allDone = total > 0 && takenCount === total;

  const pills = person.meds.slice(0, 8); // one tappable pill per medicine
  const cellH = compact ? 92 : 116;

  return (
    <div onClick={onOpen} style={{
      position: "relative", borderRadius: 30, background: c.bg, overflow: "hidden",
      padding: compact ? "20px 22px 16px" : "22px 24px 18px",
      cursor: onOpen ? "pointer" : "default",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 26px rgba(0,0,0,0.08)",
      WebkitTapHighlightColor: "transparent",
    }}>
      {/* header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{
            fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700,
            fontSize: compact ? 30 : 36, lineHeight: 1, color: ink.text, letterSpacing: -0.5,
          }}>{person.name}</div>
          <div style={{
            fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 15, marginTop: compact ? 6 : 9,
            color: ink.soft,
          }}>{compact
            ? `${takenCount}/${total} ${total === 1 ? "dose" : "doses"} today`
            : (allDone ? "All caught up for today" : "Tap each pill once you've taken it")}</div>
        </div>
        <div style={{ paddingTop: 4 }}>
          <DotRow total={total} takenCount={takenCount} color={ink.text} line={ink.line} />
        </div>
      </div>

      {/* one tappable pill per medicine — newest first, wrapping to rows */}
      <div style={{
        minHeight: cellH, margin: compact ? "6px 0 2px" : "8px 0 2px",
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
        rowGap: 6, columnGap: 2,
      }}>
        {pills.length === 0 && (
          <span style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 15, color: ink.soft }}>
            No medicine yet
          </span>
        )}
        {pills.map((m) => (
          <CardPill key={m.id} med={m} cellH={cellH} speed={speed} onToggle={onTakePill} darkCard={ink.mode === "light"} burst={m.id === burstMedId} />
        ))}
      </div>

      {/* footer: caretakers tracking this person + a "+" to share the card */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: compact ? 6 : 10 }}>
        <AvatarStack caretakers={person.caretakers || []} onAdd={onAddCaretaker} iconColor={ink.text} borderColor={c.bg} />
      </div>
    </div>
  );
}

export { Icon, DotRow, AvatarStack, Avatar, PillStack, Badge, PersonCard, ScreenHeader };
