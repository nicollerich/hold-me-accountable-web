// notification.jsx — simulated iOS reminder banner with a tap-to-fill liquid pill
import React from "react";
import { colorFor } from "./data.jsx";
import { Icon } from "./components.jsx";
import { LiquidPill3D } from "./pill3d.jsx";

const { useState: useStateN, useEffect: useEffectN } = React;

function PillNotification({ person, med, theme, onFill, onOpen, onClose }) {
  const [done, setDone] = useStateN(false);

  // auto-dismiss after success
  useEffectN(() => {
    if (!done) return;
    const t = setTimeout(() => onClose(), 1600);
    return () => clearTimeout(t);
  }, [done]);

  // safety auto-dismiss if ignored
  useEffectN(() => {
    const t = setTimeout(() => onClose(), 9000);
    return () => clearTimeout(t);
  }, []);

  const handleFill = (next) => {
    if (next >= 1 && !done) {
      onFill();
      setDone(true);
    }
  };

  const c = colorFor(person.color);

  return (
    <div style={{
      position: "absolute", bottom: 24, left: 10, right: 10, zIndex: 120,
      animation: "notifUp .5s cubic-bezier(.2,.9,.25,1)",
    }}>
      {/* grabber */}
      <div style={{ width: 120, height: 4, borderRadius: 99, background: "rgba(0,0,0,0.18)", margin: "0 auto 7px" }} />
      <div style={{
        position: "relative", borderRadius: 28, overflow: "hidden",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
      }}>
        {/* frosted glass background */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 28,
          background: "rgba(245,243,240,0.82)",
          backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)",
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: 28,
          border: "0.5px solid rgba(255,255,255,0.7)",
          boxShadow: "inset 1px 1px 1px rgba(255,255,255,0.6)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* app icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 11, flex: "0 0 auto",
            background: `linear-gradient(150deg, ${c.bg}, ${c.deep})`,
            display: "grid", placeItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}>
            {/* mini capsule glyph */}
            <div style={{
              width: 22, height: 12, borderRadius: 999, transform: "rotate(-40deg)",
              background: "linear-gradient(90deg, #3d1538 0 50%, #fff 50% 100%)",
              border: "1.5px solid rgba(0,0,0,0.35)",
            }} />
          </div>

          {/* body */}
          <div onClick={() => { if (!done) onOpen(); }} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{
                fontFamily: "-apple-system, system-ui", fontSize: 12.5, fontWeight: 600,
                letterSpacing: 0.4, color: "rgba(10,10,10,0.5)", textTransform: "uppercase",
              }}>Pill Tracker</span>
              <span style={{ fontFamily: "-apple-system, system-ui", fontSize: 12.5, color: "rgba(10,10,10,0.4)" }}>now</span>
            </div>
            {done ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#34C759", display: "grid", placeItems: "center" }}>
                  <Icon name="check" size={12} color="#fff" strokeWidth={3} />
                </span>
                <span style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 16.5, color: "#0A0A0A" }}>
                  Logged for {person.name}
                </span>
              </div>
            ) : (
              <>
                <div style={{
                  fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 16.5,
                  color: "#0A0A0A", lineHeight: 1.15, marginTop: 2,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>Time for {person.name}'s {med.name}</div>
                <div style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13.5, color: "rgba(10,10,10,0.6)", marginTop: 1 }}>
                  {med.dose} • tap the pill to log it
                </div>
              </>
            )}
          </div>

          {/* tap-to-fill liquid pill */}
          <div style={{ position: "relative", width: 64, height: 64, flex: "0 0 auto" }}>
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              background: "radial-gradient(circle at center, rgba(0,0,0,0.13) 0%, rgba(0,0,0,0) 68%)",
            }} />
            <LiquidPill3D geo={med.geo} color={med.c3d} imprint={med.imprint} fill={done ? 1 : 0}
              spin spinSpeed={done ? 0 : 46} tapToFill onToggle={handleFill} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { PillNotification };
