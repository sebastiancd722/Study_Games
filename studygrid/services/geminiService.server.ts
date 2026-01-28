import { GoogleGenAI, Type } from "@google/genai";
import { Flashcard } from "../types";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}
const ai = new GoogleGenAI({ apiKey });

export interface FileAttachment {
  mimeType: string;
  data: string; // base64 string
}

export const generateFlashcards = async (
  topic: string, 
  files: FileAttachment[] = [], 
  manualContext: string = "",
  count: number = 12
): Promise<Flashcard[]> => {
  try {
    const parts: any[] = [];

    // Add file parts if they exist
    files.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });

    // Construct the text prompt
    const promptText = `Generate ${count} distinct, challenging study flashcards (Question and Answer pairs).
    ${topic ? `Focus specifically on the topic: "${topic}".` : ''}
    ${manualContext ? `Use the following provided text/terms as the primary source material:\n"${manualContext}"` : ''}
    ${files.length > 0 ? 'Analyze the attached files to create relevant questions.' : ''}
    
    CRITICAL: You must return a valid JSON array of objects. 
    Each object must have "question", "answer", and "distractors" fields.
    
    For "distractors":
    - Provide exactly 4 plausible but incorrect answers.
    - They must be strictly related to the question's topic (slightly valid to invalid).
    - Do NOT provide completely unrelated answers.
    - Do NOT use "All of the above" or "None of the above".

    Keep questions concise (under 20 words) and answers clear (under 30 words).`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              distractors: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["question", "answer", "distractors"],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error("The model returned an empty response. This might be due to safety settings or content size.");
    }

    const data = JSON.parse(response.text);
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No flashcards were generated. Please try a different topic or document.");
    }

    return data.map((item: any, index: number) => ({
      id: `gen-${index}-${Date.now()}`,
      question: item.question,
      answer: item.answer,
      distractors: item.distractors || []
    }));

  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    // Extract meaningful message
    const message = error.message || error.toString();
    if (message.includes("400")) {
      throw new Error("Bad Request: The file might be too large or invalid, or the prompt is blocked.");
    }
    throw new Error(message);
  }
};

export const generateVariation = async (originalCard: Flashcard): Promise<Flashcard> => {
  try {
    const promptText = `
      The user got this question wrong:
      Question: "${originalCard.question}"
      Answer: "${originalCard.answer}"

      Task: Create a NEW flashcard that tests the EXACT SAME concept or term, but rephrase it significantly.
      - If the previous question asked for a definition, ask for an example.
      - If it asked "What is X?", ask "Which of the following describes X?" or "X is used for..."
      - Do NOT use the exact same wording. The goal is to prevent the user from just memorizing the answer string.
      
      Requirements:
      - Return a JSON object with "question", "answer", and "distractors".
      - "distractors" must contain 4 plausible but incorrect options related to the new question.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: promptText }] },
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            distractors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["question", "answer", "distractors"],
        },
      },
    });

    if (!response.text) throw new Error("Failed to generate variation");
    const data = JSON.parse(response.text);

    return {
      id: `var-${originalCard.id}-${Date.now()}`,
      question: data.question,
      answer: data.answer,
      distractors: data.distractors || []
    };

  } catch (error) {
    console.error("Variation Error:", error);
    // Fallback: return original but with a new ID so it's treated as a new card
    return {
      ...originalCard,
      id: `retry-${originalCard.id}-${Date.now()}`
    };
  }
};

export const validateAnswer = async (
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{ score: number; feedback: string }> => {
  try {
    const promptText = `
      Question: "${question}"
      Correct Answer: "${correctAnswer}"
      User Answer: "${userAnswer}"

      Task: Grade the User Answer on a strict scale of 0 to 100.
      
      Grading Rubric & Feedback Guide:
      
      1. Score < 50 (Incorrect):
         - The answer is factually wrong, irrelevant, or significantly incomplete.
         - Feedback: Explain specifically *why* it is wrong by comparing it to the correct concept. Identify the user's misconception if possible.
      
      2. 50 <= Score < 75 (Partial Credit):
         - The answer is vague, missing key terms, or only partially correct.
         - Feedback: Acknowledge the correct part, but explicitly point out what is missing, vague, or imprecise. (e.g., "You identified X, but missed Y").
      
      3. Score >= 75 (Correct):
         - The answer matches the core meaning of the Correct Answer.
         - Feedback: Brief positive reinforcement.

      Return JSON:
      {
        "score": integer,
        "feedback": "Specific, helpful guidance (max 30 words) directly addressing the user."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: promptText }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
          },
          required: ["score", "feedback"],
        },
      },
    });

    if (!response.text) {
      return { score: 0, feedback: "Could not validate answer." };
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Validation Error:", error);
    return { score: 0, feedback: "Error validating answer." };
  }
};