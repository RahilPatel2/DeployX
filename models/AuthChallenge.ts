import mongoose, { Schema, Document } from "mongoose";

export interface IAuthChallenge extends Document {
  challengeToken: string;
  userId: mongoose.Types.ObjectId;
  type: "mfa_login" | "mfa_stepup";
  provider: "credentials" | "google";
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumed: boolean;
  rememberMe: boolean;
  returnTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuthChallengeSchema: Schema = new Schema(
  {
    challengeToken: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["mfa_login", "mfa_stepup"], default: "mfa_login" },
    provider: { type: String, enum: ["credentials", "google"], default: "credentials" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true, index: { expires: 300 } },
    consumed: { type: Boolean, default: false },
    rememberMe: { type: Boolean, default: false },
    returnTo: { type: String, default: "/dashboard" },
  },
  { timestamps: true }
);

AuthChallengeSchema.index({ challengeToken: 1, consumed: 1 });

export default mongoose.models.AuthChallenge ||
  mongoose.model<IAuthChallenge>("AuthChallenge", AuthChallengeSchema);
