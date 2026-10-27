import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { z } from 'zod';
import { MysteryCase } from './model.js';
import { generateMystery } from './generate.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',').map(v => v.trim()) || 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));
const premiseSchema = z.object({ premise: z.string().trim().min(10).max(500), difficulty: z.enum(['easy', 'medium', 'hard']) });
const accusationSchema = z.object({ suspectId: z.string().regex(/^[a-f\d]{24}$/i) });
const validId = id => mongoose.isValidObjectId(id);
const levelBase = { easy: 100, medium: 150, hard: 200 };
const publicCase = c => ({ id: c._id, title: c.title, story: c.story, difficulty: c.difficulty, suspects: c.suspects.map(s => ({ id: s._id, name: s.name, role: s.role, description: s.description })), clues: c.clues.map(cl => ({ id: cl._id, label: cl.label, ...(c.discoveredClueIds.some(id => String(id) === String(cl._id)) ? { content: cl.content } : {}), discovered: c.discoveredClueIds.some(id => String(id) === String(cl._id)) })), hintsRemaining: c.hints.length - c.usedHintCount, progress: { cluesDiscovered: c.discoveredClueIds.length, totalClues: c.clues.length, hintsUsed: c.usedHintCount }, status: c.status });
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
async function loadCase(req, res) {
  if (!validId(req.params.id)) { fail(res, 400, 'INVALID_ID', 'That case ID is not valid.'); return null; }
  const c = await MysteryCase.findById(req.params.id);
  if (!c) { fail(res, 404, 'NOT_FOUND', 'This case could not be found.'); return null; }
  return c;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/cases', async (req, res) => {
  const validation = premiseSchema.safeParse(req.body);
  if (!validation.success) return fail(res, 400, 'INVALID_REQUEST', 'Enter a premise between 10 and 500 characters and choose a difficulty.');
  try {
    const data = await generateMystery(validation.data.premise, validation.data.difficulty);
    const c = await MysteryCase.create({ ...validation.data, title: data.title, story: data.story, suspects: data.suspects, clues: data.clues, hints: data.hints, culpritSuspectId: new mongoose.Types.ObjectId().toString(), solutionExplanation: data.solutionExplanation });
    c.culpritSuspectId = c.suspects[data.culpritIndex]._id;
    await c.save();
    res.status(201).json({ case: publicCase(c) });
  } catch (e) { console.error('Case generation failed:', e.message); fail(res, 503, 'GENERATION_FAILED', e.message.includes('not configured') ? e.message : 'We could not create a valid mystery right now. Please try again.'); }
});
app.get('/api/cases/:id', async (req, res, next) => { try { const c = await loadCase(req, res); if (c) res.json({ case: publicCase(c) }); } catch (e) { next(e); } });
app.post('/api/cases/:id/clues/:clueId/discover', async (req, res, next) => { try {
  const c = await loadCase(req, res); if (!c) return;
  if (c.status !== 'active') return fail(res, 409, 'CASE_COMPLETED', 'This investigation is already complete.');
  const clue = c.clues.id(req.params.clueId); if (!clue) return fail(res, 404, 'CLUE_NOT_FOUND', 'That clue is not part of this case.');
  if (!c.discoveredClueIds.some(id => String(id) === String(clue._id))) { c.discoveredClueIds.push(clue._id); await c.save(); }
  res.json({ case: publicCase(c) });
} catch (e) { next(e); } });
app.post('/api/cases/:id/hints', async (req, res, next) => { try {
  const c = await loadCase(req, res); if (!c) return;
  if (c.status !== 'active') return fail(res, 409, 'CASE_COMPLETED', 'This investigation is already complete.');
  if (c.usedHintCount >= c.hints.length) return fail(res, 409, 'NO_HINTS', 'You have used all available hints.');
  const index = c.usedHintCount++; await c.save();
  res.json({ hint: { index: index + 1, text: c.hints[index] }, hintsRemaining: c.hints.length - c.usedHintCount, scorePreview: Math.max(0, levelBase[c.difficulty] + c.discoveredClueIds.length * 5 - c.usedHintCount * 10) });
} catch (e) { next(e); } });
app.post('/api/cases/:id/accuse', async (req, res, next) => { try {
  const input = accusationSchema.safeParse(req.body); if (!input.success) return fail(res, 400, 'INVALID_REQUEST', 'Choose a suspect before submitting your accusation.');
  const c = await loadCase(req, res); if (!c) return;
  if (c.status !== 'active') return fail(res, 409, 'CASE_COMPLETED', 'An accusation has already been submitted.');
  if (!c.suspects.id(input.data.suspectId)) return fail(res, 400, 'UNKNOWN_SUSPECT', 'Choose a suspect from this case.');
  c.accusationSuspectId = input.data.suspectId;
  const correct = String(c.culpritSuspectId) === input.data.suspectId;
  c.score = correct ? Math.max(0, levelBase[c.difficulty] + c.discoveredClueIds.length * 5 - c.usedHintCount * 10) : 0;
  c.status = 'completed'; await c.save();
  const culprit = c.suspects.id(c.culpritSuspectId);
  res.json({ result: { correct, score: c.score, scoreBreakdown: { base: correct ? levelBase[c.difficulty] : 0, clueBonus: correct ? c.discoveredClueIds.length * 5 : 0, hintPenalty: correct ? c.usedHintCount * 10 : 0 }, culprit: { id: culprit._id, name: culprit.name }, explanation: c.solutionExplanation } });
} catch (e) { next(e); } });
app.get('/api/cases/:id/result', async (req, res, next) => { try {
  const c = await loadCase(req, res); if (!c) return;
  if (c.status !== 'completed') return fail(res, 409, 'NOT_COMPLETED', 'Submit an accusation to reveal the result.');
  const culprit = c.suspects.id(c.culpritSuspectId);
  res.json({ result: { correct: String(c.accusationSuspectId) === String(c.culpritSuspectId), score: c.score, scoreBreakdown: { base: String(c.accusationSuspectId) === String(c.culpritSuspectId) ? levelBase[c.difficulty] : 0, clueBonus: String(c.accusationSuspectId) === String(c.culpritSuspectId) ? c.discoveredClueIds.length * 5 : 0, hintPenalty: String(c.accusationSuspectId) === String(c.culpritSuspectId) ? c.usedHintCount * 10 : 0 }, culprit: { id: culprit._id, name: culprit.name }, explanation: c.solutionExplanation } });
} catch (e) { next(e); } });
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } }); });

const port = Number(process.env.PORT || 5000);
mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => app.listen(port, () => console.log(`Mystery Room API listening on ${port}`)))
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
