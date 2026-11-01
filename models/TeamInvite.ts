import mongoose, { Schema, Document } from "mongoose";

export interface ITeamInvite extends Document {
  workspaceOwnerId: mongoose.Types.ObjectId;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined";
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamInviteSchema = new Schema<ITeamInvite>(
  {
    workspaceOwnerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

TeamInviteSchema.index({ workspaceOwnerId: 1, email: 1 });

export default mongoose.models.TeamInvite || mongoose.model<ITeamInvite>("TeamInvite", TeamInviteSchema);
