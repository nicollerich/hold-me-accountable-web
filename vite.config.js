import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ── Pill-vision: a dev-only endpoint that reads a prescription label with
//    Claude's vision model. The API key stays here in Node (server-side) and is
//    never bundled into the browser. Falls back to on-device OCR when absent.
const VISION_MODEL = "claude-haiku-4-5-20251001";
const PROMPT = `You are reading a photo of a prescription medication bottle label.
Extract these fields:
- "name": the medication name (generic or brand), in Title Case, with no dosage or extra words. If you cannot read it, use "".
- "dose": the strength such as "10mg", "500mg", "2000 IU". Use "" if not visible.
- "schedule": how often it is taken — EXACTLY one of "Once Daily", "Twice Daily", "Three times daily", "Nightly", or null if unclear.
Respond with ONLY a JSON object and nothing else: {"name": string, "dose": string, "schedule": string|null}`;

function readBody(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0; const chunks = [];
    req.on("data", (c) => {
      total += c.length;
      if (total > limit) { reject(new Error("payload too large")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function parseDataUrl(s) {
  const m = /^data:(.+?);base64,(.*)$/s.exec(s || "");
  return m ? { media_type: m[1], data: m[2] } : null;
}
function extractJson(text) {
  const m = /\{[\s\S]*\}/.exec(text || "");
  if (!m) return { name: "", dose: "", schedule: null };
  try { const j = JSON.parse(m[0]); return { name: j.name || "", dose: j.dose || "", schedule: j.schedule ?? null }; }
  catch (e) { return { name: "", dose: "", schedule: null }; }
}
async function callAnthropic(apiKey, mediaType, data) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL, max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`anthropic ${r.status}: ${t.slice(0, 300)}`); }
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return extractJson(text);
}

// ── Pill analysis: same key/model, different prompt — read a single pill's
//    shape + color(s) from a close-up photo. The client falls back to an
//    on-device pixel heuristic when this is unavailable.
const PILL_PROMPT = `You are looking at a close-up photo of a single medication pill (a tablet or a capsule) on a plain surface.
Report exactly these fields:
- "shape": EXACTLY "capsule" for an elongated two-piece capsule, or "tablet" for a round or oval pressed pill.
- "primary": the pill's dominant color as a 6-digit hex string like "#A1B2C3". For a white or clear pill use "#F2EFEA".
- "secondary": if it is a two-color capsule, the other half's color as a 6-digit hex string; otherwise null.
Respond with ONLY a JSON object and nothing else: {"shape":"capsule"|"tablet","primary":"#RRGGBB","secondary":"#RRGGBB"|null}`;

function extractPillJson(text) {
  const hex = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim())) ? v.trim().toLowerCase() : null;
  const m = /\{[\s\S]*\}/.exec(text || "");
  if (!m) return { shape: "tablet", primary: null, secondary: null };
  try { const j = JSON.parse(m[0]); return { shape: j.shape === "capsule" ? "capsule" : "tablet", primary: hex(j.primary), secondary: hex(j.secondary) }; }
  catch (e) { return { shape: "tablet", primary: null, secondary: null }; }
}

async function callAnthropicPill(apiKey, mediaType, data) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL, max_tokens: 128,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: PILL_PROMPT },
      ] }],
    }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`anthropic ${r.status}: ${t.slice(0, 300)}`); }
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return extractPillJson(text);
}

function pillVision(apiKey) {
  return {
    name: "pill-vision",
    configureServer(server) {
      server.middlewares.use("/api/pill-vision/status", (req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ enabled: !!apiKey }));
      });
      server.middlewares.use("/api/pill-vision/identify", async (req, res) => {
        res.setHeader("content-type", "application/json");
        if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method" })); }
        if (!apiKey) { res.statusCode = 503; return res.end(JSON.stringify({ error: "no_key" })); }
        try {
          const body = await readBody(req);
          const img = parseDataUrl(body.image);
          if (!img) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad_image" })); }
          if (body.mode === "pill") { res.end(JSON.stringify(await callAnthropicPill(apiKey, img.media_type, img.data))); return; }
          const result = await callAnthropic(apiKey, img.media_type, img.data);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "failed", detail: String((e && e.message) || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  return {
    plugins: [react(), pillVision(apiKey)],
    // Pinned to 5180 (strict) so it never collides with other local dev servers.
    server: { port: 5180, strictPort: true, open: true },
    // tesseract.js ships its own worker/wasm — let it load at runtime, don't pre-bundle.
    optimizeDeps: { exclude: ["tesseract.js"] },
  };
});
