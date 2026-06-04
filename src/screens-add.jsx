// screens-add.jsx — AddMedicineFlow (2-step camera scan), Celebration, HistoryScreen
import React from "react";
import { uid, doseTimesFor, colorFor, inkFor, todayLabel } from "./data.jsx";
import { Icon, ScreenHeader } from "./components.jsx";
import { LiquidPill3D } from "./pill3d.jsx";
import { createScanner } from "./ocr.js";
import { visionEnabled, identifyWithAI, scanLabel } from "./vision.js";

const { useState: useStateA, useRef: useRefA, useEffect: useEffectA } = React;
const FONT = "'Atkinson Hyperlegible', system-ui";

// ── pill image analysis (client-side: dominant color + rough shape) ───
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function hexToRgb(h) {
  const x = h.replace("#", ""); const n = parseInt(x.length === 3 ? x.replace(/./g, c => c + c) : x, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(a, b, t) { return a + (b - a) * t; }
function tint(hex, t) { // blend toward a warm off-white (capsule's light half)
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(mix(r, 239, t), mix(g, 233, t), mix(b, 221, t));
}
function lum(r, g, b) { return (r * 0.299 + g * 0.587 + b * 0.114); }

// Sample the center of the pill photo: average the non-background pixels for the
// dominant color, split left/right for a two-tone capsule, and use the blob's
// aspect ratio to guess capsule vs tablet.
async function analyzePill(dataUrl) {
  let img;
  try { img = await loadImage(dataUrl); } catch (e) { return { primary: "#c2a9d6", geo: "tablet" }; }
  const S = 96;
  const cv = document.createElement("canvas"); cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  const side = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
  let data; try { data = ctx.getImageData(0, 0, S, S).data; } catch (e) { return { primary: "#c2a9d6", geo: "tablet" }; }

  let L = { r: 0, g: 0, b: 0, n: 0 }, R = { r: 0, g: 0, b: 0, n: 0 };
  let minX = S, minY = S, maxX = 0, maxY = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const l = lum(r, g, b);
    if (l > 236 || l < 26) continue;        // skip white background + dark shadow
    const side = x < S / 2 ? L : R;
    side.r += r; side.g += g; side.b += b; side.n++;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const n = L.n + R.n;
  if (n < 40) return { primary: "#c2a9d6", geo: "tablet" };       // couldn't read → fallback
  const avg = (s) => s.n ? rgbToHex(s.r / s.n, s.g / s.n, s.b / s.n) : null;
  const overall = rgbToHex((L.r + R.r) / n, (L.g + R.g) / n, (L.b + R.b) / n);

  const w = maxX - minX + 1, h = maxY - minY + 1;
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  const geo = aspect > 1.55 ? "capsule" : "tablet";

  if (geo === "capsule" && L.n > 20 && R.n > 20) {
    const lh = avg(L), rh = avg(R);
    const [lr, lg, lb] = hexToRgb(lh), [rr, rg, rb] = hexToRgb(rh);
    const darker = lum(lr, lg, lb) <= lum(rr, rg, rb) ? lh : rh;
    const lighter = darker === lh ? rh : lh;
    return { primary: darker, secondary: lighter, geo };
  }
  return geo === "capsule" ? { primary: overall, secondary: tint(overall, 0.6), geo } : { primary: overall, geo };
}

// reticle region of the live frame (matches the on-screen box), prepped for OCR
const RET = { x0: 0.11, x1: 0.89, y0: 0.20, y1: 0.74 };
function reticleCanvas(video) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sx = vw * RET.x0, sy = vh * RET.y0, sw = vw * (RET.x1 - RET.x0), sh = vh * (RET.y1 - RET.y0);
  const targetW = 1100, scale = sw ? targetW / sw : 1;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(sw * scale)); cv.height = Math.max(1, Math.round(sh * scale));
  const ctx = cv.getContext("2d");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  try {
    const id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; g = (g - 128) * 1.5 + 132; g = g < 0 ? 0 : g > 255 ? 255 : g; d[i] = d[i + 1] = d[i + 2] = g; }
    ctx.putImageData(id, 0, 0);
  } catch (e) {}
  return cv;
}
function fullFrame(video) {
  const cv = document.createElement("canvas");
  cv.width = video.videoWidth; cv.height = video.videoHeight;
  cv.getContext("2d").drawImage(video, 0, 0);
  return cv.toDataURL("image/jpeg", 0.9);
}

// ── live camera capture: AI auto-detect + manual shutter, OCR fallback ──
function CameraCapture({ theme, stepN, stepTotal, title, hint, autoscan = false, identify = false, onResult, onClose }) {
  const videoRef = useRefA(null);
  const streamRef = useRefA(null);
  const fileRef = useRefA(null);
  const [err, setErr] = useStateA(null);
  const [ready, setReady] = useStateA(false);
  const [scanMsg, setScanMsg] = useStateA(null);
  const [busy, setBusy] = useStateA(false);
  const [aiOn, setAiOn] = useStateA(undefined); // undefined until probed
  const resultRef = useRefA(onResult);
  resultRef.current = onResult;

  useEffectA(() => { visionEnabled().then(setAiOn); }, []);

  // camera setup
  useEffectA(() => {
    let active = true;
    (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setErr("unavailable"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        setReady(true);
      } catch (e) { if (active) setErr(e && e.name === "NotAllowedError" ? "denied" : "error"); }
    })();
    return () => { active = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  }, []);

  // live auto-detect: lock + capture the instant a real drug name appears
  useEffectA(() => {
    if (!autoscan || !ready || err || aiOn === undefined) return;
    let stopped = false, scanner = null;
    const lock = (label) => {
      stopped = true;
      setScanMsg(`Got it — ${label.name} ✓`);
      const full = fullFrame(videoRef.current);
      setTimeout(() => resultRef.current && resultRef.current(full, label), 450);
    };
    (async () => {
      setScanMsg("Looking for the label…");
      if (aiOn) {
        // Claude vision: scan a frame every ~2.4s, capped so it can't run away on cost
        let tries = 0;
        const tick = async () => {
          if (stopped) return;
          const v = videoRef.current;
          if (v && v.videoWidth && tries < 12) {
            tries++;
            let label = null;
            try { label = await identifyWithAI(reticleCanvas(v).toDataURL("image/jpeg", 0.85)); } catch (e) {}
            if (!stopped && label && label.confident && label.name) return lock(label);
          } else if (tries >= 12) { setScanMsg("Tap the shutter to capture"); return; }
          if (!stopped) setTimeout(tick, 2400);
        };
        tick();
      } else {
        // on-device OCR: continuous scan through one persistent worker
        try { scanner = await createScanner(); } catch (e) { return; }
        if (stopped) { scanner.stop(); return; }
        const loop = async () => {
          if (stopped) return;
          const v = videoRef.current;
          if (v && v.videoWidth) {
            let label = null;
            try { label = await scanner.scan(reticleCanvas(v)); } catch (e) {}
            if (!stopped && label && label.confident && label.name) return lock(label);
          }
          if (!stopped) setTimeout(loop, 250);
        };
        loop();
      }
    })();
    return () => { stopped = true; if (scanner) scanner.stop(); };
  }, [autoscan, ready, err, aiOn]);

  const finish = async (dataUrl) => {
    if (identify && aiOn) {
      setBusy(true); setScanMsg("Reading label…");
      let label = null;
      try { label = await scanLabel(dataUrl); } catch (e) {}
      setBusy(false);
      resultRef.current && resultRef.current(dataUrl, label && label.name ? label : null);
    } else {
      resultRef.current && resultRef.current(dataUrl, null);
    }
  };
  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    finish(fullFrame(v));
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => finish(r.result); r.readAsDataURL(f);
  };

  const errMsg = { denied: "Camera access was blocked. Choose a photo instead.", unavailable: "No camera here. Choose a photo instead.", error: "Couldn't open the camera. Choose a photo instead." };
  const status = (autoscan || busy) ? scanMsg : null;

  return (
    <div style={{ position: "relative", background: "#0E0F11", height: 480, overflow: "hidden" }}>
      {/* live preview / fallback */}
      {!err ? (
        <video ref={videoRef} playsInline muted autoPlay
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: ready ? 1 : 0, transition: "opacity .3s" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28, textAlign: "center" }}>
          <Icon name="photos" size={46} color="rgba(255,255,255,0.8)" strokeWidth={1.6} />
          <div style={{ fontFamily: FONT, fontSize: 15.5, color: "rgba(255,255,255,0.82)", maxWidth: 240 }}>{errMsg[err]}</div>
        </div>
      )}

      {/* reticle */}
      <div style={{ position: "absolute", left: "11%", right: "11%", top: "20%", bottom: "26%", border: "2px solid rgba(255,255,255,0.9)", borderRadius: 18, boxShadow: "0 0 0 9999px rgba(0,0,0,0.34)", pointerEvents: "none" }} />

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Step {stepN} of {stepTotal}</div>
          <div style={{ fontFamily: FONT, fontSize: 19, fontWeight: 700, color: "#fff", marginTop: 2, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{title}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.4)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="close" size={22} color="#fff" />
        </button>
      </div>

      {/* hint / live scan status */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 104, display: "flex", justifyContent: "center", padding: "0 24px" }}>
        <span style={{
          fontFamily: FONT, fontSize: 14.5, fontWeight: status ? 700 : 400, color: "#fff",
          background: status ? "rgba(0,0,0,0.5)" : "transparent",
          padding: status ? "7px 14px" : 0, borderRadius: 999,
          textShadow: "0 1px 6px rgba(0,0,0,0.6)", textAlign: "center",
        }}>{status || hint}</span>
      </div>

      {/* controls */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 96, display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
        <button onClick={() => fileRef.current && fileRef.current.click()} aria-label="Choose a photo"
          style={{ width: 48, height: 48, borderRadius: 14, border: "none", background: "rgba(255,255,255,0.16)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="photos" size={24} color="#fff" strokeWidth={1.8} />
        </button>
        <button onClick={snap} disabled={!ready || busy} aria-label="Capture"
          style={{ width: 72, height: 72, borderRadius: "50%", border: "5px solid rgba(255,255,255,0.95)", background: (ready && !busy) ? "#fff" : "rgba(255,255,255,0.35)", cursor: (ready && !busy) ? "pointer" : "default", boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }} />
        <div style={{ width: 48 }} />
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
    </div>
  );
}

// ── Frame the drug name on the captured bottle, then OCR that tight crop ──
function LabelCropStep({ theme, photo, onConfirm, onRetake, onClose }) {
  const wrapRef = useRefA(null);
  const [box, setBox] = useStateA({ x: 0.10, y: 0.40, w: 0.80, h: 0.15 });

  const onDown = (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, bx = box.x, by = box.y;
    const move = (ev) => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
      setBox(b => ({ ...b, x: Math.max(0, Math.min(1 - b.w, bx + dx)), y: Math.max(0, Math.min(1 - b.h, by + dy)) }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const confirm = async () => {
    try {
      const img = await loadImage(photo);
      const sw = box.w * img.naturalWidth, sh = box.h * img.naturalHeight;
      const sx = box.x * img.naturalWidth, sy = box.y * img.naturalHeight;
      const scale = sw ? 1100 / sw : 1;
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(sw * scale));
      cv.height = Math.max(1, Math.round(sh * scale));
      cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      onConfirm(cv.toDataURL("image/jpeg", 0.95));
    } catch (e) { onConfirm(photo); }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: theme.subtext }}>Step 1 of 2</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: theme.text, marginTop: 2 }}>Frame the medication name</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
          <Icon name="close" size={22} color={theme.text} />
        </button>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13.5, color: theme.subtext, margin: "6px 0 12px" }}>
        Drag the green box over the drug name, then read it.
      </div>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", background: "#000", touchAction: "none", userSelect: "none" }}>
        <img src={photo} alt="" draggable="false" style={{ width: "100%", display: "block", pointerEvents: "none" }} />
        <div onPointerDown={onDown} style={{
          position: "absolute", left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.w * 100}%`, height: `${box.h * 100}%`,
          border: "2px solid #34E07A", borderRadius: 6,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.42)", cursor: "grab",
        }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button onClick={onRetake} style={btnStyle(theme, false)}>Retake</button>
        <button onClick={confirm} style={btnStyle(theme, true)}>Read label</button>
      </div>
    </div>
  );
}

// ── Add medicine: scan bottle → frame name → scan pill → review ────────
function AddMedicineFlow({ theme, onCancel, onAdd }) {
  const [step, setStep] = useStateA("bottle"); // bottle | pill | analyzing | review
  const [bottlePhoto, setBottlePhoto] = useStateA(null);
  const [pillPhoto, setPillPhoto] = useStateA(null);
  const [draft, setDraft] = useStateA(null);
  const labelRef = useRefA(null); // in-flight OCR of the bottle label

  const backdrop = {
    position: "absolute", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
  };
  const sheet = { width: "100%", background: theme.surface, borderRadius: 30, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.45)" };

  const onBottleResult = (dataUrl, label) => {
    setBottlePhoto(dataUrl);
    if (label && label.name) { labelRef.current = Promise.resolve(label); setStep("pill"); } // read it → review
    else { setStep("bottleCrop"); } // no read → let them frame the name manually
  };
  const onCropConfirm = (cropUrl) => {
    labelRef.current = scanLabel(cropUrl, { preCropped: true }); // Claude vision, else on-device OCR
    setStep("pill");
  };
  const onPill = async (dataUrl) => {
    setPillPhoto(dataUrl);
    setStep("analyzing");
    const [{ primary, secondary, geo }, label] = await Promise.all([
      analyzePill(dataUrl),
      labelRef.current || Promise.resolve({ name: "", dose: "", schedule: null }),
    ]);
    const schedule = label.schedule || "Once Daily";
    const time = schedule === "Nightly" ? "9:00 PM" : "8:00 AM";
    setDraft({
      id: uid("med"), name: label.name || "", schedule, dose: label.dose || "",
      pill: geo === "capsule" ? "capsule" : "tablet", geo,
      c3d: secondary ? { primary, secondary } : { primary }, imprint: null,
      time, detail: "", nameRead: !!label.name,
      doses: doseTimesFor(schedule, time).map(t => ({ id: uid("dose"), time: t, taken: false })),
    });
    setStep("review");
  };

  const setGeo = (geo) => setDraft(d => {
    if (geo === d.geo) return d;
    const c3d = geo === "capsule"
      ? { primary: d.c3d.primary, secondary: d.c3d.secondary || tint(d.c3d.primary, 0.6) }
      : { primary: d.c3d.primary };
    return { ...d, geo, pill: geo === "capsule" ? "capsule" : "tablet", c3d };
  });

  // ── camera steps ──
  if (step === "bottle") {
    return (
      <div style={backdrop}>
        <div style={{ ...sheet, padding: 0 }}>
          <CameraCapture theme={theme} stepN={1} stepTotal={2}
            title="Scan the bottle" hint="Hold the label steady in the box — it captures itself"
            autoscan identify onResult={onBottleResult} onClose={onCancel} />
        </div>
      </div>
    );
  }
  if (step === "bottleCrop") {
    return (
      <div style={backdrop}>
        <div style={{ ...sheet, padding: 0 }}>
          <LabelCropStep theme={theme} photo={bottlePhoto}
            onConfirm={onCropConfirm} onRetake={() => setStep("bottle")} onClose={onCancel} />
        </div>
      </div>
    );
  }
  if (step === "pill") {
    return (
      <div style={backdrop}>
        <div style={{ ...sheet, padding: 0 }}>
          <CameraCapture theme={theme} stepN={2} stepTotal={2}
            title="Scan the pill" hint="Place one pill on a plain surface, centered in the frame"
            onResult={(url) => onPill(url)} onClose={onCancel} />
        </div>
      </div>
    );
  }
  if (step === "analyzing") {
    return (
      <div style={backdrop}>
        <div style={{ ...sheet, padding: 0 }}>
          <div style={{ position: "relative", height: 420, background: "#000", overflow: "hidden" }}>
            {pillPhoto && <img src={pillPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />}
            <div style={{ position: "absolute", left: "12%", right: "12%", height: 3, borderRadius: 3, background: "linear-gradient(90deg, transparent, #34E07A, transparent)", boxShadow: "0 0 16px 4px rgba(52,224,122,0.7)", animation: "scanLine 1.15s ease-in-out infinite" }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 24, textAlign: "center", fontFamily: FONT, fontSize: 16, fontWeight: 700, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>Reading the label…</div>
          </div>
        </div>
      </div>
    );
  }

  // ── review (detected pill + confirm details) ──
  const detected = draft.c3d.primary;
  return (
    <div style={backdrop} onClick={onCancel}>
      <div style={{ ...sheet, padding: "10px 20px 20px", maxHeight: "92%", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: theme.subtext }}>Review &amp; confirm</span>
          <button onClick={onCancel} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}>
            <Icon name="close" size={24} color={theme.text} />
          </button>
        </div>

        {/* detected 3D pill — drag to orbit, tap to pour */}
        <div style={{ position: "relative", height: 168 }}>
          <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", width: "62%", height: "86%", borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 68%)" }} />
          <div style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", width: "52%", height: 20, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(0,0,0,0.2), rgba(0,0,0,0) 70%)" }} />
          <LiquidPill3D geo={draft.geo} color={draft.c3d} fill={0} spin spinSpeed={26} orbit tapToFill />
        </div>

        {/* captured shots + detection note */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 }}>
          {[{ src: bottlePhoto, label: "Bottle" }, { src: pillPhoto, label: "Pill" }].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", border: `1px solid ${theme.hairline}`, background: theme.chip }}>
                {s.src && <img src={s.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: theme.subtext, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 6 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: detected, border: `1px solid ${theme.hairline}` }} />
            <span style={{ fontFamily: FONT, fontSize: 12.5, color: theme.subtext }}>color &amp; shape detected</span>
          </div>
        </div>

        {/* name */}
        <input value={draft.name} placeholder="Medication name"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={{ width: "100%", boxSizing: "border-box", textAlign: "center", border: "none", background: "transparent", fontFamily: FONT, fontWeight: 700, fontSize: 26, color: theme.text, marginTop: 8, outline: "none" }} />
        <input value={draft.dose} placeholder="Dose — e.g. 10mg"
          onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
          style={{ width: "100%", boxSizing: "border-box", textAlign: "center", border: "none", background: "transparent", fontFamily: FONT, fontSize: 15.5, color: theme.subtext, marginTop: 4, outline: "none" }} />

        {!draft.name && (
          <div style={{ textAlign: "center", marginTop: 6, fontFamily: FONT, fontSize: 12.5, color: theme.subtext }}>
            Couldn't read the name from the label — type it in above
          </div>
        )}

        {/* shape toggle */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          {[{ k: "capsule", l: "Capsule" }, { k: "tablet", l: "Tablet" }].map(s => (
            <button key={s.k} onClick={() => setGeo(s.k)} style={{
              padding: "8px 16px", borderRadius: 999, cursor: "pointer",
              border: `1.5px solid ${draft.geo === s.k ? theme.text : theme.hairline}`,
              background: draft.geo === s.k ? theme.text : "transparent",
              color: draft.geo === s.k ? theme.surface : theme.subtext,
              fontFamily: FONT, fontSize: 14, fontWeight: 700,
            }}>{s.l}</button>
          ))}
        </div>

        {/* schedule chips */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", margin: "14px 0 4px" }}>
          {["Once Daily", "Twice Daily", "Three times daily", "Nightly"].map(s => (
            <button key={s} onClick={() => setDraft({ ...draft, schedule: s, doses: doseTimesFor(s, draft.time).map(t => ({ id: uid("dose"), time: t, taken: false })) })} style={{
              padding: "8px 14px", borderRadius: 999, cursor: "pointer",
              border: `1.5px solid ${draft.schedule === s ? theme.text : theme.hairline}`,
              background: draft.schedule === s ? theme.text : "transparent",
              color: draft.schedule === s ? theme.surface : theme.subtext,
              fontFamily: FONT, fontSize: 14, fontWeight: 700,
            }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "12px 0 18px", color: theme.subtext }}>
          <Icon name="clock" size={16} color={theme.subtext} />
          <span style={{ fontFamily: FONT, fontSize: 15 }}>Reminder at {draft.doses[0] ? draft.doses[0].time : draft.time}</span>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={btnStyle(theme, false)}>Cancel</button>
          <button onClick={() => onAdd({ ...draft, name: draft.name.trim() || "New medicine" })} style={btnStyle(theme, true)}>Add medicine</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle = (t, primary) => ({
  flex: 1, padding: "15px", borderRadius: 999, cursor: "pointer", border: "none",
  fontFamily: FONT, fontWeight: 700, fontSize: 16.5,
  background: primary ? "#0A0A0A" : t.chip, color: primary ? "#fff" : t.text,
  boxShadow: primary ? "0 6px 16px rgba(0,0,0,0.2)" : "none",
});

// ── Celebration overlay when a person finishes all meds ───────────────
function Celebration({ person, theme, onClose }) {
  useEffectA(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, []);
  const c = colorFor(person.color);
  const ink = inkFor(person.color);
  const confetti = Array.from({ length: 26 });
  const palette = ["#D53302", "#FCC560", "#A0CBAD", "#8FB1BE", "#3a1236"];
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 90, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 30,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
    }}>
      {confetti.map((_, i) => {
        const left = Math.random() * 100, delay = Math.random() * 0.5, dur = 1.8 + Math.random() * 1.4;
        const sz = 7 + Math.random() * 9;
        return <span key={i} style={{
          position: "absolute", top: -20, left: `${left}%`, width: sz, height: sz,
          background: palette[i % palette.length], borderRadius: i % 2 ? "50%" : 2,
          animation: `confettiFall ${dur}s linear ${delay}s infinite`,
        }} />;
      })}
      <div style={{
        background: c.bg, borderRadius: 30, padding: "30px 28px 26px", width: "100%", textAlign: "center",
        boxShadow: "0 30px 70px rgba(0,0,0,0.4)", position: "relative",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", background: ink.text, margin: "0 auto 16px",
          display: "grid", placeItems: "center",
        }}>
          <Icon name="check" size={40} color={c.bg} strokeWidth={2.6} />
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: ink.text, letterSpacing: -0.5 }}>
          All caught up, {person.name}!
        </div>
        <div style={{ fontFamily: FONT, fontSize: 16, color: ink.soft, marginTop: 8 }}>
          Every pill taken for today. Nice work holding each other accountable.
        </div>
      </div>
    </div>
  );
}

// ── History / streak log ──────────────────────────────────────────────
function HistoryScreen({ state, theme, onBack }) {
  const today = todayLabel();
  const groups = {};
  state.history.slice().reverse().forEach(h => {
    (groups[h.day] = groups[h.day] || []).push(h);
  });
  const dayKeys = Object.keys(groups);
  const streak = 4 + (state.history.length > 0 ? 1 : 0);

  return (
    <div style={{ minHeight: "100%", background: theme.appBg }}>
      <ScreenHeader theme={theme}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px 4px" }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 44, height: 44, borderRadius: "50%", border: `1.5px solid ${theme.hairline}`,
          background: theme.chip, cursor: "pointer", display: "grid", placeItems: "center",
        }}>
          <Icon name="back" size={24} color={theme.text} strokeWidth={2.2} />
        </button>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: theme.text }}>History</span>
      </div>
      </ScreenHeader>

      {/* streak card */}
      <div style={{ padding: "10px 16px 6px" }}>
        <div style={{
          borderRadius: 24, background: "#A0CBAD", padding: "22px 24px", color: "#06351C",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 44, lineHeight: 1, color: "#0A0A0A" }}>{streak}</div>
            <div style={{ fontFamily: FONT, fontSize: 15.5, marginTop: 6, color: "rgba(10,10,10,0.78)" }}>day streak</div>
          </div>
          <Icon name="spark" size={56} color="#0A0A0A" strokeWidth={1.6} />
        </div>
      </div>

      <div style={{ padding: "12px 16px 40px" }}>
        {state.history.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 10px", color: theme.subtext, fontFamily: FONT, fontSize: 16 }}>
            Nothing logged yet today. Tap a pill or a “Take” button and it’ll show up here.
          </div>
        )}
        {dayKeys.map(day => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, color: theme.subtext, margin: "0 4px 8px" }}>
              {day === today.line1 ? "Today" : day}
            </div>
            <div style={{ background: theme.surface, borderRadius: 18, overflow: "hidden" }}>
              {groups[day].map((h, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                  borderTop: i ? `1px solid ${theme.hairline}` : "none",
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: colorFor(h.color).bg, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    <Icon name="check" size={16} color={inkFor(h.color).text} strokeWidth={2.6} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: theme.text }}>{h.med}</div>
                    <div style={{ fontFamily: FONT, fontSize: 13.5, color: theme.subtext }}>{h.person}</div>
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 13.5, color: theme.subtext }}>{h.at}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { AddMedicineFlow, Celebration, HistoryScreen };
