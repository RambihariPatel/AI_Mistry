import mongoose from 'mongoose';

const suspectSchema = new mongoose.Schema({ name: String, role: String, description: String }, { _id: true });
const clueSchema = new mongoose.Schema({ label: String, content: String }, { _id: true });

const caseSchema = new mongoose.Schema({
  premise: { type: String, required: true },
  title: { type: String, required: true },
  story: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  suspects: [suspectSchema], clues: [clueSchema], hints: [String],
  culpritSuspectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  solutionExplanation: { type: String, required: true },
  discoveredClueIds: [{ type: mongoose.Schema.Types.ObjectId }],
  usedHintCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  accusationSuspectId: mongoose.Schema.Types.ObjectId,
  score: { type: Number, default: null }
}, { timestamps: true });

export const MysteryCase = mongoose.model('MysteryCase', caseSchema);
