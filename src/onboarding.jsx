// onboarding.jsx — WelcomeScreen (first run) + AuthScreen (email + one-time code)
import React from "react";
import { PILL_IMG } from "./data.jsx";
import { Icon } from "./components.jsx";

const { useState: useStateO, useRef: useRefO } = React;
const FF = "'Atkinson Hyperlegible', system-ui";

// the three sample "person" cards used on both onboarding screens
const CARDS = [
  { name: "Stephen", ink: "#0A0A0A", bg: "#F2C230", pill: PILL_IMG.tablet, med: "Children's Tylenol", sub: "1 tablet by mouth every 4 hours • 10mg" },
  { name: "Mila", ink: "#FFFFFF", bg: "#DD6038", pill: PILL_IMG.tablet, med: "Children's Tylenol", sub: "1 tablet by mouth every 4 hours • 10mg" },
  { name: "Henrik", ink: "#FFFFFF", bg: "#43A24A", pill: PILL_IMG.capsule, med: "Dexmethylphenidate", sub: "1 Capsule by mouth every morning • 10mg" },
];

// a sample "person" card (positioned by the caller via `style`)
function MiniCard({ name, ink, bg, pill, med, sub, style }) {
  const soft = ink === "#0A0A0A" ? "rgba(10,10,10,0.66)" : "rgba(255,255,255,0.88)";
  return (
    <div style={{
      width: 206, boxSizing: "border-box", borderRadius: 22, background: bg,
      padding: "16px 16px 18px", boxShadow: "0 16px 34px rgba(0,0,0,0.16)", ...style,
    }}>
      <div style={{ textAlign: "center", fontFamily: FF, fontWeight: 700, fontSize: 19, color: ink, letterSpacing: -0.3 }}>{name}</div>
      <div style={{ height: 84, display: "grid", placeItems: "center", margin: "8px 0 10px" }}>
        <img src={pill} alt="" draggable="false" style={{ maxWidth: "50%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 8px 9px rgba(0,0,0,0.22))" }} />
      </div>
      <div style={{ textAlign: "center", fontFamily: FF, fontWeight: 700, fontSize: 15, color: ink, letterSpacing: -0.2 }}>{med}</div>
      <div style={{ textAlign: "center", fontFamily: FF, fontSize: 11, color: soft, marginTop: 3, lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
}

// a slow conveyor of cards drifting right → left (loops seamlessly). The tall
// container + inset top keep cards below the status bar and leave room so the
// card shadows aren't clipped top or bottom.
function CardMarquee() {
  const row = [...CARDS, ...CARDS]; // two copies → animate to -50% for a seamless loop
  const stagger = [0, 16, 6];
  return (
    <div style={{ position: "relative", height: 344, overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: 64, animation: "marqueeLeft 36s linear infinite", willChange: "transform" }}>
        {row.map((c, i) => (
          <div key={i} style={{ marginRight: 14, marginTop: stagger[i % 3], flex: "0 0 auto" }}>
            <MiniCard {...c} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WelcomeScreen({ theme, onGetStarted }) {
  return (
    <div style={{ minHeight: "100%", background: theme.appBg, display: "flex", flexDirection: "column", padding: "66px 26px 32px", boxSizing: "border-box" }}>
      <div style={{ position: "relative", height: 392, flex: "0 0 auto" }}>
        {/* each card floats on a wrapper (rotation stays on the card) — desynced for organic motion */}
        <div style={{ position: "absolute", left: 0, top: 6, zIndex: 1, animation: "cardFloat 4.6s ease-in-out infinite" }}>
          <MiniCard {...CARDS[0]} style={{ transform: "rotate(-7deg)" }} />
        </div>
        <div style={{ position: "absolute", right: -6, top: 118, zIndex: 2, animation: "cardFloat 5.4s ease-in-out 0.7s infinite" }}>
          <MiniCard {...CARDS[1]} style={{ transform: "rotate(9deg)" }} />
        </div>
        <div style={{ position: "absolute", left: 30, top: 236, zIndex: 3, animation: "cardFloat 5s ease-in-out 0.35s infinite" }}>
          <MiniCard {...CARDS[2]} style={{ transform: "rotate(-6deg)" }} />
        </div>
      </div>
      <div style={{ marginTop: "auto", fontFamily: FF, fontWeight: 700, fontSize: 47, lineHeight: 0.98, letterSpacing: -1.5, color: theme.text }}>
        Helping<br />each other<br />stay on top<br />of it.
      </div>
      <button onClick={onGetStarted} style={{
        marginTop: 26, width: "100%", padding: "19px 20px", borderRadius: 999, border: "none",
        background: "#0A0A0A", color: "#fff", fontFamily: FF, fontWeight: 700, fontSize: 18, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.22)",
      }}>
        Get started <span style={{ fontSize: 20, lineHeight: 1 }}>→</span>
      </button>
    </div>
  );
}

const primaryBtn = (enabled) => ({
  width: "100%", padding: "18px", borderRadius: 999, border: "none", background: "#0A0A0A",
  color: "#fff", fontFamily: FF, fontWeight: 700, fontSize: 17, cursor: enabled ? "pointer" : "default",
  opacity: enabled ? 1 : 0.4, transition: "opacity .2s", boxShadow: enabled ? "0 8px 20px rgba(0,0,0,0.2)" : "none",
});

function KeepRow({ theme, keep, onToggle }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", marginTop: 14 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6, flex: "0 0 auto", display: "grid", placeItems: "center",
        border: `1.5px solid ${keep ? "#0A0A0A" : theme.hairline}`, background: keep ? "#0A0A0A" : "transparent",
      }}>
        {keep && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
      </span>
      <span style={{ fontFamily: FF, fontSize: 15, color: theme.text }}>Keep me signed in</span>
    </button>
  );
}

function AuthScreen({ theme, onAuthed }) {
  const [step, setStep] = useStateO("email"); // email | code
  const [email, setEmail] = useStateO("");
  const [keep, setKeep] = useStateO(true);
  const [code, setCode] = useStateO(["", "", "", "", "", ""]);
  const inputsRef = useRefO([]);

  const validEmail = /\S+@\S+\.\S+/.test(email.trim());
  const filled = code.every((d) => d !== "");
  const toggleKeep = () => setKeep((k) => !k);

  const sendCode = () => { if (validEmail) { setCode(["", "", "", "", "", ""]); setStep("code"); setTimeout(() => inputsRef.current[0] && inputsRef.current[0].focus(), 60); } };
  const verify = () => { if (filled) onAuthed(email.trim(), keep); };
  const onDigit = (i, v) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    setCode((prev) => { const n = [...prev]; n[i] = ch; return n; });
    if (ch && i < 5 && inputsRef.current[i + 1]) inputsRef.current[i + 1].focus();
  };
  const onKey = (i, e) => { if (e.key === "Backspace" && !code[i] && i > 0 && inputsRef.current[i - 1]) inputsRef.current[i - 1].focus(); };

  return (
    <div style={{ minHeight: "100%", background: theme.appBg, display: "flex", flexDirection: "column", padding: "0 0 34px", boxSizing: "border-box" }}>
      {/* carousel — vertically centered in the space above the form */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%" }}><CardMarquee /></div>
      </div>

      {step === "email" ? (
        // headline + byline grouped with the form, anchored toward the bottom
        <div style={{ padding: "0 28px" }}>
          <div style={{ fontFamily: FF, fontWeight: 700, fontSize: 40, color: theme.text, letterSpacing: -1, lineHeight: 1.02 }}>Create an account</div>
          <div style={{ fontFamily: FF, fontSize: 17, color: theme.subtext, marginTop: 12, lineHeight: 1.35 }}>
            Sign in to track medications together with the people you care for.
          </div>

          <div style={{ marginTop: 24 }}>
            <label style={{ fontFamily: FF, fontSize: 13.5, color: theme.subtext }}>Email</label>
            <input value={email} type="email" autoComplete="email" placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendCode(); }}
              style={{
                marginTop: 8, width: "100%", boxSizing: "border-box", padding: "15px 16px", borderRadius: 14,
                border: `1.5px solid ${theme.hairline}`, background: theme.surface, color: theme.text,
                outline: "none", fontFamily: FF, fontSize: 17,
              }} />
            <KeepRow theme={theme} keep={keep} onToggle={toggleKeep} />
            <button onClick={sendCode} disabled={!validEmail} style={{ ...primaryBtn(validEmail), marginTop: 12 }}>Continue</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 28px" }}>
          <div style={{ fontFamily: FF, fontWeight: 700, fontSize: 34, color: theme.text, letterSpacing: -0.8, lineHeight: 1.05 }}>Enter your code</div>
          <div style={{ fontFamily: FF, fontSize: 16, color: theme.subtext, marginTop: 10, lineHeight: 1.35 }}>
            We sent a 6-digit code to <span style={{ color: theme.text, fontWeight: 700 }}>{email.trim()}</span>.
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              {code.map((d, i) => (
                <input key={i} ref={(el) => (inputsRef.current[i] = el)} value={d} inputMode="numeric" maxLength={1}
                  onChange={(e) => onDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
                  style={{
                    width: 46, height: 56, textAlign: "center", borderRadius: 14, boxSizing: "border-box",
                    border: `1.5px solid ${d ? theme.text : theme.hairline}`, background: theme.surface, color: theme.text,
                    outline: "none", fontFamily: FF, fontWeight: 700, fontSize: 24,
                  }} />
              ))}
            </div>
            <KeepRow theme={theme} keep={keep} onToggle={toggleKeep} />
            <button onClick={verify} disabled={!filled} style={{ ...primaryBtn(filled), marginTop: 12 }}>Verify &amp; continue</button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <button onClick={() => setStep("email")} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: FF, fontSize: 14, color: theme.subtext, padding: 0 }}>← Use a different email</button>
              <button onClick={() => setCode(["", "", "", "", "", ""])} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: FF, fontSize: 14, fontWeight: 700, color: theme.text, padding: 0 }}>Resend code</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { WelcomeScreen, AuthScreen };
