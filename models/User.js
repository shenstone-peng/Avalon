import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 20,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      maxlength: 200,
      select: false,
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function preSave() {
  if (!this.isModified('password')) return;
  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const rounds = Number.isFinite(saltRounds) ? Math.min(Math.max(saltRounds, 10), 14) : 12;
  this.password = await bcrypt.hash(this.password, rounds);
});

UserSchema.methods.verifyPassword = async function verifyPassword(candidatePassword) {
  // Ensure we have hashed password loaded
  if (!this.password) {
    const fresh = await this.constructor.findById(this._id).select('+password');
    if (!fresh?.password) return false;
    return bcrypt.compare(candidatePassword, fresh.password);
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
