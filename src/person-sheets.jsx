// person-sheets.jsx — EditPersonSheet + ShareSheet (detail-screen actions)
import React from "react";
import { PALETTE } from "./data.jsx";
import { Icon, Avatar } from "./components.jsx";

const FF = "'Atkinson Hyperlegible', system-ui";

const { useState: useStateP } = React;

function sheetBackdrop(onClose) {
  return {
    position: "absolute", inset: 0, zIndex: 85,
    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12,
  };
}
const sheetCard = (theme) => ({
  width: "100%", background: theme.surface, borderRadius: 30, overflow: "hidden",
  boxShadow: "0 -10px 50px rgba(0,0,0,0.4)", padding: "10px 20px 22px",
});

// ── Edit the person taking the meds ───────────────────────────────────
function EditPersonSheet({ person, theme, onSave, onCancel }) {
  const [name, setName] = useStateP(person.name);
  const [color, setColor] = useStateP(person.color);

  return (
    <div style={sheetBackdrop()} onClick={onCancel}>
      <div style={sheetCard(theme)} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: theme.hairline, margin: "2px auto 14px" }} />
        <div style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 22, color: theme.text, marginBottom: 14 }}>
          Edit person
        </div>

        <label style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13.5, color: theme.subtext }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{
          width: "100%", boxSizing: "border-box", marginTop: 6, marginBottom: 18,
          padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${theme.hairline}`,
          background: theme.chip, color: theme.text, outline: "none",
          fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 19,
        }} />

        <label style={{ fontFamily: "'Atkinson Hyperlegible', system-ui", fontSize: 13.5, color: theme.subtext }}>Card color</label>
        <div style={{ display: "flex", gap: 10, marginTop: 10, marginBottom: 22, flexWrap: "wrap" }}>
          {PALETTE.map(p => (
            <button key={p.key} onClick={() => setColor(p.key)} aria-label={p.key} style={{
              width: 44, height: 44, borderRadius: "50%", cursor: "pointer", background: p.bg,
              border: color === p.key ? `3px solid ${theme.text}` : `1.5px solid ${theme.hairline}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={pBtn(theme, false)}>Cancel</button>
          <button onClick={() => onSave({ name: name.trim() || person.name, color })} style={pBtn(theme, true)}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Share a card so others can access + track this person with you ────
function ShareSheet({ person, theme, onClose, onInvite }) {
  const [copied, setCopied] = useStateP(false);
  const [invite, setInvite] = useStateP("");
  const link = `holdme.app/u/${person.name.toLowerCase()}-${person.id.slice(-4)}`;
  const caretakers = person.caretakers || [];

  const copyLink = () => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(link); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const open = (href) => { try { window.open(href); } catch (e) {} };
  const send = () => { const n = invite.trim(); if (!n) return; onInvite && onInvite(n); setInvite(""); };
  const msg = encodeURIComponent(`Track ${person.name}'s meds with me: ${link}`);

  const targets = [
    { key: "copy", icon: "link", label: copied ? "Copied!" : "Copy link", onClick: copyLink },
    { key: "msg", icon: "message", label: "Messages", onClick: () => open(`sms:?&body=${msg}`) },
    { key: "mail", icon: "mail", label: "Mail", onClick: () => open(`mailto:?subject=${encodeURIComponent(`Help track ${person.name}'s medication`)}&body=${msg}`) },
  ];

  return (
    <div style={sheetBackdrop()} onClick={onClose}>
      <div style={sheetCard(theme)} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: theme.hairline, margin: "2px auto 14px" }} />
        <div style={{ fontFamily: FF, fontWeight: 700, fontSize: 22, color: theme.text }}>
          Share {person.name}'s card
        </div>
        <div style={{ fontFamily: FF, fontSize: 14.5, color: theme.subtext, marginTop: 6, marginBottom: 16 }}>
          Anyone you add can open {person.name}'s card and check off doses — and you'll see who did.
        </div>

        {/* who's tracking now */}
        {caretakers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            {caretakers.map(ct => (
              <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Avatar ct={ct} size={26} border={theme.surface} />
                <span style={{ fontFamily: FF, fontSize: 14, color: theme.text }}>{ct.id === "me" ? "You" : ct.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* invite by name → adds a caretaker with access */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite by name…"
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            style={{
              flex: 1, boxSizing: "border-box", padding: "13px 14px", borderRadius: 14,
              border: `1.5px solid ${theme.hairline}`, background: theme.chip, color: theme.text,
              outline: "none", fontFamily: FF, fontSize: 16,
            }} />
          <button onClick={send} style={{
            padding: "0 18px", borderRadius: 14, border: "none", background: "#0A0A0A", color: "#fff",
            cursor: "pointer", fontFamily: FF, fontWeight: 700, fontSize: 15,
          }}>Invite</button>
        </div>

        {/* link chip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14,
          background: theme.chip, border: `1.5px solid ${theme.hairline}`, marginBottom: 16,
        }}>
          <Icon name="link" size={18} color={theme.subtext} />
          <span style={{ flex: 1, fontFamily: FF, fontSize: 14.5, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</span>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {targets.map(t => (
            <button key={t.key} onClick={t.onClick}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer",
                background: "transparent", border: "none", padding: "4px 0",
              }}>
              <span style={{
                width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center",
                background: theme.chip, border: `1.5px solid ${theme.hairline}`,
              }}>
                <Icon name={t.icon} size={24} color={theme.text} strokeWidth={1.9} />
              </span>
              <span style={{ fontFamily: FF, fontSize: 13, color: theme.subtext }}>{t.label}</span>
            </button>
          ))}
        </div>

        <button onClick={onClose} style={pBtn(theme, true)}>Done</button>
      </div>
    </div>
  );
}

const pBtn = (t, primary) => ({
  flex: 1, width: primary ? undefined : "100%", padding: "15px", borderRadius: 999, cursor: "pointer", border: "none",
  fontFamily: "'Atkinson Hyperlegible', system-ui", fontWeight: 700, fontSize: 16.5,
  background: primary ? "#0A0A0A" : t.chip, color: primary ? "#fff" : t.text,
  boxShadow: primary ? "0 6px 16px rgba(0,0,0,0.2)" : "none",
});

export { EditPersonSheet, ShareSheet };
