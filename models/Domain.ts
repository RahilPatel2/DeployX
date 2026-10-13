import mongoose, { Schema, Document } from 'mongoose';

export type DomainStatus = 'active' | 'pending' | 'error';

export interface IDomain extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  domain: string;
  status: DomainStatus;
  cloudflareCustomDomainId?: string;
  verificationData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const DomainSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    domain: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'pending', 'error'],
      default: 'pending'
    },
    cloudflareCustomDomainId: { type: String },
    verificationData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Indexes
DomainSchema.index({ userId: 1, createdAt: -1 });
DomainSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.models.Domain || mongoose.model<IDomain>('Domain', DomainSchema);
