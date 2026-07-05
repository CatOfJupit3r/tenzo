import mongoose from 'mongoose';
import crypto from 'node:crypto';

export function ObjectIdString() {
  return new mongoose.Types.ObjectId().toHexString();
}

export function generatePublicCode(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}
