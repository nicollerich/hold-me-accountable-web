// pill3d.jsx — React wrapper around the LiquidPill three.js module
// Fill semantics: 0 = transparent glass shell (NOT taken, spinning),
//                 1 = solid liquid-filled (TAKEN).
import React from "react";
import { PILL_IMG } from "./data.jsx";
import { LiquidPill } from "./liquid-pill.js";
import { pillField } from "./pill-field-instance.js";

const { useRef: useRef3, useEffect: useEffect3 } = React;

function LiquidPill3D({
  geo = "capsule", color = { primary: "#3d1538", secondary: "#ece6da" },
  fill = 0, spin = true, spinSpeed = 30, orbit = false, tapToFill = false,
  imprint, onToggle, style,
}) {
  const hostRef = useRef3(null);
  const pillRef = useRef3(null);
  const fillRef = useRef3(fill > 0.5 ? 1 : 0);
  const onToggleRef = useRef3(onToggle);
  onToggleRef.current = onToggle;

  // mount once
  useEffect3(() => {
    if (pillRef.current || !hostRef.current) return;
    pillRef.current = new LiquidPill(hostRef.current, {
      pillType: geo, pillColor: color, spin, spinSpeed,
      orbitControls: orbit, tapToFill, background: "transparent",
      initialFill: fillRef.current, imprint,
      onFillChange: tapToFill ? (v) => {
        const target = v > 0.5 ? 1 : 0;
        if (target !== fillRef.current) {
          fillRef.current = target;
          onToggleRef.current && onToggleRef.current(target);
        }
      } : null,
    });
    return () => {
      if (pillRef.current) { pillRef.current.destroy(); pillRef.current = null; }
    };
  }, []);

  // sync fill from props
  useEffect3(() => {
    const target = fill > 0.5 ? 1 : 0;
    fillRef.current = target;
    pillRef.current && pillRef.current.setFill(target);
  }, [fill]);

  // sync color / geo / spin
  useEffect3(() => { pillRef.current && pillRef.current.setPillColor(color); }, [color && color.primary, color && color.secondary]);
  useEffect3(() => { pillRef.current && pillRef.current.setPillType(geo); }, [geo]);
  useEffect3(() => {
    if (!pillRef.current) return;
    pillRef.current.setSpin(spin);
    pillRef.current.opts.spinSpeed = spinSpeed;
  }, [spin, spinSpeed]);

  // when not using the lib's tap handling, capture clicks at the React layer
  const handleClick = (!tapToFill && onToggle)
    ? (e) => { e.stopPropagation(); const next = fillRef.current > 0.5 ? 0 : 1; onToggle(next); }
    : undefined;

  return (
    <div ref={hostRef} onClick={handleClick} style={{
      width: "100%", height: "100%",
      cursor: onToggle ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
      ...style,
    }} />
  );
}

// cheap 2D thumbnail for dense lists (no WebGL context)
function PillThumb({ med, size = 44, faded = false }) {
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
      <img src={PILL_IMG[med.pill]} alt="" draggable="false" style={{
        maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
        opacity: faded ? 0.4 : 1, filter: faded ? "grayscale(0.6)" : "drop-shadow(0 3px 5px rgba(0,0,0,0.18))",
        transition: "opacity .3s ease, filter .3s ease",
      }} />
    </div>
  );
}

// ── PooledPill: a placeholder that registers with the single shared PillField
//    (one WebGL context for ALL card pills). ───────────────────────────────
let __ppCounter = 0;
function PooledPill({ geo, color, fill = 0, spin = true, spinSpeed = 30, imprint, burst, onToggle, style }) {
  const ref = useRef3(null);
  const idRef = useRef3("pp-" + (++__ppCounter));
  const propsRef = useRef3({ fill, spin, spinSpeed });
  propsRef.current = { fill, spin, spinSpeed };

  useEffect3(() => {
    if (burst) pillField.burst(idRef.current);
  }, [burst]);

  useEffect3(() => {
    const id = idRef.current;
    if (!ref.current) return;
    pillField.add(id, {
      geo, color, imprint, canvas: ref.current,
      getFill: () => Math.max(0, Math.min(1, propsRef.current.fill)), // fractional 0..1
      getSpin: () => propsRef.current.spin,
      getSpeed: () => propsRef.current.spinSpeed,
    });
    return () => { pillField.remove(id); };
  }, []);

  useEffect3(() => {
    pillField.setColor(idRef.current, color);
  }, [color && color.primary, color && color.secondary]);

  const handleClick = onToggle ? (e) => { e.stopPropagation(); onToggle(); } : undefined;
  return <canvas ref={ref} onClick={handleClick} style={{
    width: "100%", height: "100%", display: "block", position: "relative", zIndex: 1,
    cursor: onToggle ? "pointer" : "default",
    WebkitTapHighlightColor: "transparent", ...style,
  }} />;
}

export { LiquidPill3D, PillThumb, PooledPill };
