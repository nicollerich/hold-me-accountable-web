// screens-main.jsx — HomeScreen, DetailScreen, MedRow (swipe-to-delete)
import React from "react";
import { todayLabel, colorFor, inkFor, medDoses, medTakenCount } from "./data.jsx";
import { Icon, Badge, PersonCard, ScreenHeader, Avatar } from "./components.jsx";
import { PillThumb } from "./pill3d.jsx";

const { useState: useStateM, useRef: useRefM } = React;

// parse "8:00 AM" → minutes since midnight
function timeToMinutes(t) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || "");
  if (!m) return 9 * 60;
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// group dose-instances ({med, dose}) into Morning / Afternoon / Night by dose time
function groupDosesByPeriod(meds) {
  const defs = [
    { key: "morning",   label: "Morning",   icon: "sun",    lo: 5 * 60,  hi: 12 * 60 },
    { key: "afternoon", label: "Afternoon", icon: "sunset", lo: 12 * 60, hi: 17 * 60 },
    { key: "night",     label: "Night",     icon: "moon",   lo: 17 * 60, hi: 24 * 60 + 5 * 60 },
  ];
  const periodOf = (min) => {
    const norm = min < 5 * 60 ? min + 24 * 60 : min; // pre-dawn → night bucket
    return defs.find(d => norm >= d.lo && norm < d.hi) || defs[0];
  };
  const instances = [];
  meds.forEach(m => medDoses(m).forEach(dose => instances.push({ med: m, dose })));
  return defs
    .map(d => ({
      ...d,
      items: instances
        .filter(it => periodOf(timeToMinutes(it.dose.time)).key === d.key)
        .sort((a, b) => timeToMinutes(a.dose.time) - timeToMinutes(b.dose.time)),
    }))
    .filter(s => s.items.length > 0);
}

// ── A single medicine row with swipe-left-to-delete ───────────────────
function MedRow({ med, dose, theme, color, caretakers, onToggle, onDelete }) {
  const [dx, setDx] = useStateM(0);
  const start = useRefM(null);
  const moved = useRefM(false);
  const c = color ? colorFor(color) : null;
  const ink = color ? inkFor(color) : null;
  const rowBg = c ? c.bg : theme.surface;
  const titleColor = ink ? ink.text : theme.text;
  const subColor = ink ? ink.soft : theme.subtext;
  const taken = dose ? dose.taken : med.taken;
  const doseTime = dose ? dose.time : med.time;
  const by = (taken && dose && dose.takenBy && caretakers) ? caretakers.find(x => x.id === dose.takenBy) : null;
  const OPEN = -88;

  const onDown = (e) => {
    start.current = (e.touches ? e.touches[0].clientX : e.clientX) - (dx < 0 ? dx : 0);
    moved.current = false;
  };
  const onMove = (e) => {
    if (start.current == null) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    let next = x - start.current;
    if (next > 0) next = 0;
    if (next < -120) next = -120;
    if (Math.abs(next - dx) > 2) moved.current = true;
    setDx(next);
  };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (dx < -118) { onDelete(); return; }       // full swipe = delete
    setDx(dx < OPEN / 2 ? OPEN : 0);              // snap open / closed
  };

  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "transparent" }}>
      {/* delete affordance behind */}
      <button onClick={onDelete} style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 88,
        border: "none", background: "#E5392B", color: "#fff", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
        fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13, fontWeight: 700,
      }}>
        <Icon name="trash" size={22} color="#fff" strokeWidth={2} />
        Delete
      </button>
      {/* foreground */}
      <div
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        style={{
          position: "relative", background: rowBg,
          padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, transform: `translateX(${dx}px)`,
          transition: start.current == null ? "transform .28s cubic-bezier(.2,.8,.2,1)" : "none",
          touchAction: "pan-y", userSelect: "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <PillThumb med={med} size={46} faded={!taken} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 21,
              color: titleColor, lineHeight: 1.1, letterSpacing: -0.3,
            }}>{med.name}</div>
            <div style={{
              fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 14.5, marginTop: 5,
              color: subColor,
            }}>{med.schedule} • {med.dose}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <Icon name="clock" size={14} color={subColor} strokeWidth={2} />
              <span style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13.5, color: subColor }}>{doseTime}</span>
            </div>
            {by && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <Avatar ct={by} size={16} border={ink ? ink.border : theme.hairline} />
                <span style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 12.5, color: subColor }}>
                  {by.id === "me" ? "Taken by you" : `Taken by ${by.name}`}
                </span>
              </div>
            )}
          </div>
        </div>
        <Badge taken={taken} ink={ink} onClick={(e) => { e.stopPropagation(); if (!moved.current) onToggle(); }} />
      </div>
    </div>
  );
}

// ── Home: date header + scrollable list of person cards ───────────────
function HomeScreen({ state, theme, speed, onOpenPerson, onTakePill, onAddCaretaker, onSettings, burstMedId }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const d = todayLabel();
  const roundBtn = {
    width: 44, height: 44, borderRadius: "50%", flex: "0 0 auto",
    border: `1.5px solid ${theme.hairline}`, background: theme.chip, cursor: "pointer",
    display: "grid", placeItems: "center",
  };
  return (
    <div style={{ minHeight: "100%", background: theme.appBg }}>
      <div id="pf-cliptop" style={{
        position: "sticky", top: 0, zIndex: 50, paddingTop: 56,
        background: theme.appBgBlur, backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
      }}>
        <div style={{ padding: "6px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{
            fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 34, lineHeight: 1.05,
            color: theme.text, letterSpacing: -0.5,
          }}>
            {d.line1}<br/>{d.line2}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onSettings} aria-label="Settings" style={roundBtn}>
              <Icon name="settings" size={21} color={theme.text} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 14px 40px" }}>
        {state.people.map(p => (
          <PersonCard key={p.id} person={p} speed={speed} burstMedId={burstMedId}
            onOpen={() => onOpenPerson(p.id)}
            onTakePill={(medId) => onTakePill(p.id, medId)}
            onAddCaretaker={() => onAddCaretaker(p.id)} />
        ))}
      </div>
    </div>
  );
}

// ── Detail: person header + medicine list + add ───────────────────────
function DetailScreen({ person, theme, speed, onBack, onTakePill, onToggleMed, onDeleteMed, onAddMedicine, onAddCaretaker, onShare, onEdit, burstMedId }) {
  const [collapsed, setCollapsed] = useStateM({}); // { morning|afternoon|night: true }
  if (!person) return null;
  return (
    <div style={{ minHeight: "100%", background: theme.appBg }}>
      {/* frosted sticky header */}
      <ScreenHeader theme={theme}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px 10px" }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 44, height: 44, borderRadius: "50%", border: `1.5px solid ${theme.hairline}`,
          background: theme.chip, cursor: "pointer", display: "grid", placeItems: "center",
        }}>
          <Icon name="back" size={24} color={theme.text} strokeWidth={2.2} />
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onEdit} aria-label="Edit person" style={{
          width: 44, height: 44, borderRadius: "50%", border: `1.5px solid ${theme.hairline}`,
          background: theme.chip, cursor: "pointer", display: "grid", placeItems: "center",
        }}>
          <Icon name="edit" size={21} color={theme.text} strokeWidth={2} />
        </button>
      </div>
      </ScreenHeader>

      <div style={{ padding: "4px 14px 8px" }}>
        <PersonCard person={person} speed={speed} compact burstMedId={burstMedId}
          onTakePill={(medId) => onTakePill(person.id, medId)}
          onAddCaretaker={onAddCaretaker} />
      </div>

      {/* medicine list, grouped by time of day */}
      <div style={{ padding: "8px 14px 12px" }}>
        {person.meds.length === 0 && (
          <div style={{
            textAlign: "center", padding: "24px 0", color: theme.subtext,
            fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 16,
          }}>No medicine yet. Add one below.</div>
        )}
        {groupDosesByPeriod(person.meds).map(section => {
          const open = !collapsed[section.key];
          return (
          <div key={section.key} style={{ marginBottom: 18 }}>
            <button onClick={() => setCollapsed(c => ({ ...c, [section.key]: open }))}
              aria-expanded={open} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8, margin: "2px 0 9px",
                padding: "4px 4px", border: "none", background: "transparent", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}>
              <Icon name={section.icon} size={17} color={theme.subtext} strokeWidth={2} />
              <span style={{
                fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13,
                fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: theme.subtext,
              }}>{section.label}</span>
              <span style={{
                fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 12.5, color: theme.subtext,
                marginLeft: "auto",
              }}>{section.items.filter(it => it.dose.taken).length}/{section.items.length}</span>
              <Icon name="chevron" size={16} color={theme.subtext} strokeWidth={2.4}
                style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s ease" }} />
            </button>
            {open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {section.items.map(it => (
                  <MedRow key={it.dose.id} med={it.med} dose={it.dose} theme={theme} color={person.color} caretakers={person.caretakers}
                    onToggle={() => onToggleMed(person.id, it.med.id, it.dose.id)}
                    onDelete={() => onDeleteMed(person.id, it.med.id)} />
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* add new */}
      <div style={{ padding: "0 14px 40px" }}>
        <button onClick={onAddMedicine} style={{
          width: "100%", padding: "20px", borderRadius: 18, cursor: "pointer",
          border: `2px dashed ${theme.hairline}`, background: "transparent",
          fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 16.5, color: theme.text,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Icon name="plus" size={20} color={theme.text} strokeWidth={2.2} />
          Add a new medicine
        </button>
        <div style={{
          textAlign: "center", marginTop: 12, color: theme.subtext,
          fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13.5,
        }}>Swipe a medicine left to remove it</div>
      </div>
    </div>
  );
}

export { HomeScreen, DetailScreen, MedRow };
