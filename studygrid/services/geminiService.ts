import { Flashcard } from "../types";

// Client-side wrapper that calls the Vercel Serverless Function at /api/ai.
// The Gemini API key stays on the server (set GEMINI_API_KEY in Vercel env vars).

export interface FileAttachment {
  mimeType: string;
  data: string; // base64 string
}

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
type ApiResp<T> = ApiOk<T> | ApiErr;

async function postAI<T>(task: string, args: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, args }),
      signal: controller.signal,
    });

    let json: ApiResp<T>;
    try {
      json = (await res.json()) as ApiResp<T>;
    } catch {
      throw new Error("Server returned a non-JSON response.");
    }

    if (!res.ok || !json.ok) {
      const msg = (json as ApiErr).error || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return (json as ApiOk<T>).data;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Try again with smaller input.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export const generateFlashcards = async (
  topic: string,
  files: FileAttachment[] = [],
  manualContext: string = "",
  count: number = 12
): Promise<Flashcard[]> => {
  const data = await postAI<{ cards: Flashcard[] }>("generateFlashcards", {
    topic,
    files,
    manualContext,
    count,
  });
  return data.cards;
};

export const generateVariation = async (originalCard: Flashcard): Promise<Flashcard> => {
  const data = await postAI<{ card: Flashcard }>("generateVariation", { originalCard });
  return data.card;
};

export const validateAnswer = async (
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{ score: number; feedback: string }> => {
  const data = await postAI<{ result: { score: number; feedback: string } }>("validateAnswer", {
    question,
    correctAnswer,
    userAnswer,
  });
  return data.result;
};
