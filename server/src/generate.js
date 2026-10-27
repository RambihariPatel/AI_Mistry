import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const counts = { easy: { suspects: 3, clues: 5, hints: 2 }, medium: { suspects: 4, clues: 7, hints: 3 }, hard: { suspects: 5, clues: 9, hints: 3 } };
const generatedSchema = z.object({
  title: z.string().min(3).max(100), story: z.string().min(80).max(5000),
  suspects: z.array(z.object({ name: z.string().min(2).max(60), role: z.string().min(2).max(80), description: z.string().min(10).max(500) })),
  clues: z.array(z.object({ label: z.string().min(2).max(80), content: z.string().min(15).max(1000) })),
  hints: z.array(z.string().min(10).max(400)), culpritIndex: z.number().int().nonnegative(),
  solutionExplanation: z.string().min(30).max(2000)
});

export async function generateMystery(premise, difficulty) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Mystery generation is not configured. Add GEMINI_API_KEY to the server environment.');
  const countsForLevel = counts[difficulty];
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: `Create a fair, original, logically solvable detective mystery based on this premise: ${premise}\nDifficulty: ${difficulty}. Return exactly ${countsForLevel.suspects} suspects, ${countsForLevel.clues} clues, and ${countsForLevel.hints} progressive hints. Every clue must be compatible with one solution and support it; include red herrings that remain fair. Hints must not name the culprit outright. Ensure the story does not reveal the solution. Return JSON only with keys title, story, suspects (objects name, role, description), clues (objects label, content), hints (strings), culpritIndex (zero-based), solutionExplanation (string). The solution explanation must connect concrete clues to the culprit.`,
    config: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { title: { type: 'STRING' }, story: { type: 'STRING' }, suspects: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, role: { type: 'STRING' }, description: { type: 'STRING' } }, required: ['name', 'role', 'description'] } }, clues: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, content: { type: 'STRING' } } } }, hints: { type: 'ARRAY', items: { type: 'STRING' } }, culpritIndex: { type: 'INTEGER' }, solutionExplanation: { type: 'STRING' } }, required: ['title', 'story', 'suspects', 'clues', 'hints', 'culpritIndex', 'solutionExplanation'] } }
  });
  let parsed;
  try { parsed = generatedSchema.parse(JSON.parse(response.text)); }
  catch { throw new Error('The generated case did not meet the required format. Please try again.'); }
  if (parsed.suspects.length !== countsForLevel.suspects || parsed.clues.length !== countsForLevel.clues || parsed.hints.length !== countsForLevel.hints || parsed.culpritIndex >= parsed.suspects.length || new Set(parsed.suspects.map(s => s.name.toLowerCase())).size !== parsed.suspects.length) {
    throw new Error('The generated case did not meet the required counts. Please try again.');
  }
  return parsed;
}
