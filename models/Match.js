import mongoose from 'mongoose';

const MatchPlayerSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    roleKey: { type: String, required: true },
    alliance: { type: String, enum: ['GOOD', 'EVIL'], required: true },
    won: { type: Boolean, required: true },
  },
  { _id: false }
);

const MatchSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true, index: true },
    winner: { type: String, enum: ['GOOD', 'EVIL'], required: true, index: true },
    reason: { type: String, default: null },
    playerCount: { type: Number, required: true },
    players: { type: [MatchPlayerSchema], required: true },
  },
  { timestamps: true }
);

MatchSchema.index({ 'players.userId': 1, endedAt: -1 });

export const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);
