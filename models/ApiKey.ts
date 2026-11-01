import mongoose, { Schema, Document } from "mongoose";

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  prefix: string;
  keyHash: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

ApiKeySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
