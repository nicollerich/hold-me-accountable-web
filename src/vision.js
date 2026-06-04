// vision.js — client side of the AI label reader. Talks to the dev endpoint
// (/api/pill-vision/*) which holds the API key server-side. Falls back to the
// on-device OCR (ocr.js) when AI is unavailable.
import { readLabel } from "./ocr.js";

let _statusCache = null; // null = unknown, true/false once probed

export async function visionEnabled() {
  if (_statusCache !== null) return _statusCache;
  try {
    const r = await fetch("/api/pill-vision/status");
    _statusCache = r.ok ? !!(await r.json()).enabled : false;
  } catch (e) { _statusCache = false; }
  return _statusCache;
}

function normalizeSchedule(s) {
  if (!s) return null;
  const t = String(s).toLowerCase();
  if (t.includes("three") || t.includes("3")) return "Three times daily";
  if (t.includes("twice") || t.includes("two") || t.includes("2")) return "Twice Daily";
  if (t.includes("night") || t.includes("bed")) return "Nightly";
  if (t.includes("once") || t.includes("daily") || t.includes("morning") || t.includes("day")) return "Once Daily";
  return null;
}

// shrink large captures before upload (vision models resize anyway; saves bandwidth/cost)
async function shrink(dataUrl, maxW = 1400) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    if (!img.width || img.width <= maxW) return dataUrl;
    const scale = maxW / img.width;
    const cv = document.createElement("canvas");
    cv.width = maxW; cv.height = Math.round(img.height * scale);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.85);
  } catch (e) { return dataUrl; }
}

export async function identifyWithAI(dataUrl) {
  try {
    const image = await shrink(dataUrl);
    const r = await fetch("/api/pill-vision/identify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j.name !== "string") return null;
    const name = j.name.trim();
    return { name, dose: (j.dose || "").trim(), schedule: normalizeSchedule(j.schedule), confident: !!name, source: "ai" };
  } catch (e) { return null; }
}

// Best available read: Claude vision first (if enabled), else on-device OCR.
export async function scanLabel(dataUrl, opts = {}) {
  if (await visionEnabled()) {
    const ai = await identifyWithAI(dataUrl);
    if (ai && ai.name) return ai;
  }
  return readLabel(dataUrl, opts);
}

// Ask Claude vision for a pill's shape + color(s). Returns { primary, geo,
// secondary? } shaped like the on-device analyzePill(), or null when the AI is
// unavailable / couldn't read a color (caller then uses the local heuristic).
export async function identifyPillWithAI(dataUrl) {
  try {
    const image = await shrink(dataUrl);
    const r = await fetch("/api/pill-vision/identify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image, mode: "pill" }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const hex = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim())) ? v.trim() : null;
    const primary = hex(j && j.primary);
    if (!primary) return null;
    const geo = j.shape === "capsule" ? "capsule" : "tablet";
    const secondary = geo === "capsule" ? hex(j.secondary) : null;
    return secondary ? { primary, secondary, geo } : { primary, geo };
  } catch (e) { return null; }
}

// Best available pill read: Claude vision if enabled, else null so the caller
// falls back to the on-device color/shape heuristic.
export async function scanPill(dataUrl) {
  if (await visionEnabled()) {
    const ai = await identifyPillWithAI(dataUrl);
    if (ai && ai.primary) return ai;
  }
  return null;
}
