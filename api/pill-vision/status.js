// Vercel serverless function — mirrors the dev-only /api/pill-vision/status
// middleware from vite.config.js. Tells the client whether the Claude-vision
// label reader is available (i.e. the API key is configured server-side).
export default function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ enabled: !!process.env.ANTHROPIC_API_KEY }));
}
