import mongoose, { Schema, Document } from 'mongoose';

export interface IIntegration extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string; // e.g., 'github'
  accessToken: string;
  refreshToken?: string;
  providerAccountId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    providerAccountId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Ensure a user can only have one integration per provider
IntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });

export default mongoose.models.Integration || mongoose.model<IIntegration>('Integration', IntegrationSchema);
