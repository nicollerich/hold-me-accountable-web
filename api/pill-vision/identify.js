// Vercel serverless function — production counterpart to the dev-only
// /api/pill-vision/identify middleware in vite.config.js. Reads a prescription
// label with Claude's vision model. The API key stays here in Node (server-side)
// and is never bundled into the browser. The client falls back to on-device OCR
// when this is unavailable (see src/vision.js → src/ocr.js).
const VISION_MODEL = "claude-haiku-4-5-20251001";
const PROMPT = `You are reading a photo of a prescription medication bottle label.
Extract these fields:
- "name": the medication name (generic or brand), in Title Case, with no dosage or extra words. If you cannot read it, use "".
- "dose": the strength such as "10mg", "500mg", "2000 IU". Use "" if not visible.
- "schedule": how often it is taken — EXACTLY one of "Once Daily", "Twice Daily", "Three times daily", "Nightly", or null if unclear.
Respond with ONLY a JSON object and nothing else: {"name": string, "dose": string, "schedule": string|null}`;

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

// Vercel may pre-parse JSON bodies into req.body; if not, read the raw stream.
function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); } }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let total = 0; const chunks = []; const limit = 8 * 1024 * 1024;
    req.on("data", (c) => {
      total += c.length;
      if (total > limit) { reject(new Error("payload too large")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
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

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "method" })); }
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) { res.statusCode = 503; return res.end(JSON.stringify({ error: "no_key" })); }
  try {
    const body = await readBody(req);
    const img = parseDataUrl(body.image);
    if (!img) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad_image" })); }
    const result = await callAnthropic(apiKey, img.media_type, img.data);
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "failed", detail: String((e && e.message) || e) }));
  }
}
