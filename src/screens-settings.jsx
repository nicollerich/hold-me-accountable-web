// screens-settings.jsx — Settings: manage tracked people, theme, history, reports
import React from "react";
import { colorFor } from "./data.jsx";
import { Icon, ScreenHeader } from "./components.jsx";

const FONT = "'Atkinson Hyperlegible', system-ui";
const MIN_PEOPLE = 1;
const MAX_PEOPLE = 8;

function SectionLabel({ theme, children }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 13, fontWeight: 700, letterSpacing: 0.6,
      textTransform: "uppercase", color: theme.subtext, margin: "2px 4px 9px",
    }}>{children}</div>
  );
}

function Toggle({ on, onClick, theme }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={!!on} aria-label="Toggle" style={{
      position: "relative", width: 46, height: 28, borderRadius: 999, border: "none",
      cursor: "pointer", padding: 0, background: on ? "#34C759" : "rgba(120,120,128,0.32)",
      transition: "background .18s ease", flex: "0 0 auto",
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .18s ease",
      }} />
    </button>
  );
}

function SettingsScreen({ state, theme, dark, onBack, onAddPerson, onRemovePerson, onToggleDark, onOpenHistory, onOpenReports, onSignOut }) {
  const people = state.people;
  const count = people.length;
  const atMin = count <= MIN_PEOPLE;
  const atMax = count >= MAX_PEOPLE;

  const card = { background: theme.surface, borderRadius: 18, overflow: "hidden" };
  const stepBtn = (disabled) => ({
    width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${theme.hairline}`,
    background: theme.chip, cursor: disabled ? "default" : "pointer", display: "grid",
    placeItems: "center", opacity: disabled ? 0.4 : 1, flex: "0 0 auto",
  });
  const linkRow = (extra = {}) => ({
    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, padding: "15px 16px", border: "none", background: "transparent", cursor: "pointer",
    ...extra,
  });
  const linkLabel = { fontFamily: FONT, fontWeight: 700, fontSize: 16.5, color: theme.text };

  return (
    <div style={{ minHeight: "100%", background: theme.appBg }}>
      <ScreenHeader theme={theme}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px 6px" }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 44, height: 44, borderRadius: "50%", border: `1.5px solid ${theme.hairline}`,
          background: theme.chip, cursor: "pointer", display: "grid", placeItems: "center",
        }}>
          <Icon name="back" size={24} color={theme.text} strokeWidth={2.2} />
        </button>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: theme.text }}>Settings</span>
      </div>
      </ScreenHeader>

      {/* People list with per-row remove */}
      <div style={{ padding: "12px 16px 4px" }}>
        <SectionLabel theme={theme}>People you track</SectionLabel>
        <div style={card}>
          {people.map((p, i) => {
            const c = colorFor(p.color);
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                borderTop: i ? `1px solid ${theme.hairline}` : "none",
              }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: c.bg, border: `1px solid ${theme.hairline}`, flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: theme.text }}>{p.name}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13.5, color: theme.subtext }}>
                    {p.meds.length} {p.meds.length === 1 ? "medicine" : "medicines"}
                  </div>
                </div>
                <button onClick={atMin ? undefined : () => onRemovePerson(p.id)} disabled={atMin}
                  aria-label={`Remove ${p.name}`} style={{
                    border: "none", background: "transparent", padding: 6,
                    cursor: atMin ? "default" : "pointer", opacity: atMin ? 0.35 : 1,
                  }}>
                  <Icon name="trash" size={20} color={theme.subtext} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={atMax ? undefined : onAddPerson} disabled={atMax} style={{
          width: "100%", marginTop: 12, padding: "16px", borderRadius: 18,
          cursor: atMax ? "default" : "pointer", border: `2px dashed ${theme.hairline}`,
          background: "transparent", fontFamily: FONT, fontSize: 16, color: theme.text,
          opacity: atMax ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Icon name="plus" size={20} color={theme.text} strokeWidth={2.2} />
          Add a person
        </button>
      </div>

      {/* Reports + history */}
      <div style={{ padding: "16px 16px 4px" }}>
        <SectionLabel theme={theme}>Reports</SectionLabel>
        <div style={card}>
          <button onClick={onOpenReports} style={linkRow()}>
            <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Icon name="send" size={20} color={theme.text} strokeWidth={2} />
              <span style={linkLabel}>Send a report</span>
            </span>
            <Icon name="chevron" size={18} color={theme.subtext} strokeWidth={2.2} />
          </button>
          <button onClick={onOpenHistory} style={linkRow({ borderTop: `1px solid ${theme.hairline}` })}>
            <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Icon name="history" size={20} color={theme.text} strokeWidth={2} />
              <span style={linkLabel}>History &amp; streak</span>
            </span>
            <Icon name="chevron" size={18} color={theme.subtext} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* General */}
      <div style={{ padding: "16px 16px 40px" }}>
        <SectionLabel theme={theme}>General</SectionLabel>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
            <span style={linkLabel}>Dark mode</span>
            <Toggle on={dark} onClick={onToggleDark} theme={theme} />
          </div>
          {onSignOut && (
            <button onClick={onSignOut} style={linkRow({ borderTop: `1px solid ${theme.hairline}`, justifyContent: "flex-start" })}>
              <span style={{ ...linkLabel, color: "#E5392B" }}>Sign out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { SettingsScreen };
