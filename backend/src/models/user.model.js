import mongoose from 'mongoose';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Safety net: even if a query forgets to exclude it, the hash
      // never leaves the server in a JSON response.
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Uniqueness is enforced by the database, not by a "find then insert" check,
// because two simultaneous requests can both pass such a check.
userSchema.index({ email: 1 }, { unique: true });

// strength 2 makes "Sara.K" and "sara.k" the same username, while we still
// keep the casing the user typed for display.
userSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export const User = mongoose.model('User', userSchema);