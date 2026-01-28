import { generateFlashcards, generateVariation, validateAnswer } from "../services/geminiService.server";

// Basic in-memory rate limit (best-effort; resets when the function container restarts)
const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: any): string {
  const xf = req.headers?.["x-forwarded-for"]; 
  if (typeof xf === "string") return xf.split(",")[0].trim();
  if (Array.isArray(xf)) return xf[0];
  return req.socket?.remoteAddress || "unknown";
}

function rateLimit(req: any, limit = 25, windowMs = 60_000): { ok: boolean; retryAfter?: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || now >= cur.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { ok: true };
}

function setCors(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  const allow = process.env.ALLOWED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) || [];
  if (origin && allow.length > 0 && allow.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin && allow.length === 0) {
    // Default: allow the requesting origin (common for same-origin deployments)
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const rl = rateLimit(req);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter || 60));
    return res.status(429).json({ ok: false, error: "Rate limit exceeded. Try again shortly." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const task = body.task as string;
    const args = (body.args || {}) as any;

    if (!task) return res.status(400).json({ ok: false, error: "Missing task" });

    // Lightweight payload guards (prevent accidental huge requests)
    const rawSize = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (rawSize > 4_000_000) {
      return res.status(413).json({ ok: false, error: "Request too large. Use smaller files / shorter text." });
    }

    if (task === "generateFlashcards") {
      const { topic = "", files = [], manualContext = "", count = 12 } = args;
      const cards = await generateFlashcards(String(topic), files, String(manualContext), Number(count));
      return res.status(200).json({ ok: true, data: { cards } });
    }

    if (task === "generateVariation") {
      const { originalCard } = args;
      if (!originalCard) return res.status(400).json({ ok: false, error: "Missing originalCard" });
      const card = await generateVariation(originalCard);
      return res.status(200).json({ ok: true, data: { card } });
    }

    if (task === "validateAnswer") {
      const { question, correctAnswer, userAnswer } = args;
      if (!question || !correctAnswer || typeof userAnswer !== "string") {
        return res.status(400).json({ ok: false, error: "Missing fields" });
      }
      const result = await validateAnswer(String(question), String(correctAnswer), String(userAnswer));
      return res.status(200).json({ ok: true, data: { result } });
    }

    return res.status(400).json({ ok: false, error: `Unknown task: ${task}` });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
