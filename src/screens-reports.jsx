// screens-reports.jsx — ReportScreen: pick a range, see adherence, send a report
import React from "react";
import { buildReport, REPORT_RANGES, colorFor, inkFor, todayLabel } from "./data.jsx";
import { Icon, ScreenHeader } from "./components.jsx";

const { useState: useStateR } = React;
const FONT = "'Atkinson Hyperlegible', system-ui";
const pct = (x) => Math.round(x * 100) + "%";

// adherence → a calm green→amber→red read
function gradeColor(a) {
  if (a >= 0.9) return "#34C759";
  if (a >= 0.75) return "#E7AC3C";
  return "#E5713B";
}

function reportText(report, rangeLabel, today) {
  const lines = [
    "Hold Me Accountable — adherence report",
    `${rangeLabel} · through ${today}`,
    "",
    `Overall: ${pct(report.adherence)} (${report.totalTaken}/${report.totalScheduled} doses, ${report.totalMissed} missed)`,
    "",
  ];
  report.perPerson.forEach(p => {
    lines.push(`• ${p.name}: ${pct(p.adherence)} — ${p.taken}/${p.scheduled} doses, ${p.currentStreak}-day streak`);
  });
  return lines.join("\n");
}

function Bar({ value, color, track }) {
  return (
    <div style={{ height: 7, borderRadius: 99, background: track, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(3, value * 100)}%`, height: "100%", borderRadius: 99, background: color, transition: "width .4s ease" }} />
    </div>
  );
}

function SendSheet({ theme, text, onClose }) {
  const [copied, setCopied] = useStateR(false);
  const enc = encodeURIComponent(text);

  const doCopy = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const targets = [
    { key: "copy", icon: "link", label: copied ? "Copied!" : "Copy", onClick: doCopy },
    { key: "msg", icon: "message", label: "Messages", href: `sms:?&body=${enc}` },
    { key: "mail", icon: "mail", label: "Mail", href: `mailto:?subject=${encodeURIComponent("Pill tracker report")}&body=${enc}` },
  ];

  const pBtn = {
    width: "100%", padding: "15px", borderRadius: 999, cursor: "pointer", border: "none",
    fontFamily: FONT, fontWeight: 700, fontSize: 16.5, background: "#0A0A0A", color: "#fff",
    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
  };

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 85, background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: theme.surface, borderRadius: 30, overflow: "hidden",
        boxShadow: "0 -10px 50px rgba(0,0,0,0.4)", padding: "10px 20px 22px",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: theme.hairline, margin: "2px auto 14px" }} />
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: theme.text }}>Send report</div>
        <div style={{ fontFamily: FONT, fontSize: 14.5, color: theme.subtext, marginTop: 6, marginBottom: 16 }}>
          Share this summary with a doctor, caretaker, or family member.
        </div>

        {/* report preview */}
        <div style={{
          background: theme.chip, border: `1.5px solid ${theme.hairline}`, borderRadius: 14,
          padding: "12px 14px", marginBottom: 18, maxHeight: 168, overflowY: "auto",
        }}>
          <pre style={{
            margin: 0, whiteSpace: "pre-wrap", fontFamily: FONT, fontSize: 13.5,
            lineHeight: 1.5, color: theme.text,
          }}>{text}</pre>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {targets.map(t => {
            const inner = (
              <>
                <span style={{
                  width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: theme.chip, border: `1.5px solid ${theme.hairline}`,
                }}>
                  <Icon name={t.icon} size={24} color={theme.text} strokeWidth={1.9} />
                </span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: theme.subtext }}>{t.label}</span>
              </>
            );
            const style = {
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              cursor: "pointer", background: "transparent", border: "none", padding: "4px 0",
              textDecoration: "none",
            };
            return t.href
              ? <a key={t.key} href={t.href} style={style}>{inner}</a>
              : <button key={t.key} onClick={t.onClick} style={style}>{inner}</button>;
          })}
        </div>

        <button onClick={onClose} style={pBtn}>Done</button>
      </div>
    </div>
  );
}

function ReportScreen({ state, theme, onBack }) {
  const [rangeKey, setRangeKey] = useStateR("week");
  const [sending, setSending] = useStateR(false);
  const range = REPORT_RANGES.find(r => r.key === rangeKey) || REPORT_RANGES[0];
  const report = buildReport(state.people, range.days);
  const today = todayLabel().line1;
  const text = reportText(report, range.label, today);
  const overallColor = gradeColor(report.adherence);

  const card = { background: theme.surface, borderRadius: 18, padding: "18px 20px" };

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
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: theme.text }}>Reports</span>
      </div>
      </ScreenHeader>

      {/* range chips */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 6px" }}>
        {REPORT_RANGES.map(r => {
          const on = r.key === rangeKey;
          return (
            <button key={r.key} onClick={() => setRangeKey(r.key)} style={{
              flex: 1, padding: "11px 6px", borderRadius: 999, cursor: "pointer",
              border: `1.5px solid ${on ? theme.text : theme.hairline}`,
              background: on ? theme.text : "transparent",
              color: on ? theme.appBg : theme.subtext,
              fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
            }}>{r.label}</button>
          );
        })}
      </div>

      {/* overall summary */}
      <div style={{ padding: "8px 16px 4px" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 46, lineHeight: 1, color: overallColor }}>
                {pct(report.adherence)}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 14.5, color: theme.subtext, marginTop: 7 }}>
                adherence · {range.short}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: theme.text }}>
                {report.totalTaken}/{report.totalScheduled}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 13.5, color: theme.subtext, marginTop: 3 }}>
                doses · {report.totalMissed} missed
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Bar value={report.adherence} color={overallColor} track={theme.chip} />
          </div>
        </div>
      </div>

      {/* per-person breakdown */}
      <div style={{ padding: "14px 16px 4px" }}>
        <div style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 700, letterSpacing: 0.6,
          textTransform: "uppercase", color: theme.subtext, margin: "2px 4px 9px",
        }}>By person</div>
        <div style={{ background: theme.surface, borderRadius: 18, overflow: "hidden" }}>
          {report.perPerson.map((p, i) => {
            const c = colorFor(p.color);
            const col = gradeColor(p.adherence);
            return (
              <div key={p.id} style={{ padding: "14px 16px", borderTop: i ? `1px solid ${theme.hairline}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: c.bg, border: `1px solid ${theme.hairline}`, flex: "0 0 auto" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: theme.text }}>{p.name}</div>
                    <div style={{ fontFamily: FONT, fontSize: 13, color: theme.subtext }}>
                      {p.taken}/{p.scheduled} doses · {p.currentStreak}-day streak
                    </div>
                  </div>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: col, fontVariantNumeric: "tabular-nums" }}>
                    {pct(p.adherence)}
                  </span>
                </div>
                <div style={{ marginTop: 9 }}>
                  <Bar value={p.adherence} color={col} track={theme.chip} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* send */}
      <div style={{ padding: "16px 16px 40px" }}>
        <button onClick={() => setSending(true)} style={{
          width: "100%", padding: "16px", borderRadius: 999, cursor: "pointer", border: "none",
          fontFamily: FONT, fontWeight: 700, fontSize: 16.5, background: "#0A0A0A", color: "#fff",
          boxShadow: "0 6px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        }}>
          <Icon name="send" size={19} color="#fff" strokeWidth={2} />
          Send this report
        </button>
        <div style={{ textAlign: "center", marginTop: 12, color: theme.subtext, fontFamily: FONT, fontSize: 13 }}>
          Covers the {range.short} window through today
        </div>
      </div>

      {sending && <SendSheet theme={theme} text={text} onClose={() => setSending(false)} />}
    </div>
  );
}

export { ReportScreen };
