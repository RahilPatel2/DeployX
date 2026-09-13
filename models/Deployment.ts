import mongoose, { Schema, Document } from 'mongoose';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED' | 'CANCELED';

export interface IDeployment extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  cloudflareDeploymentId?: string;
  status: DeploymentStatus;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  url?: string;
  duration?: number;
  environment: string;
  logs?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DeploymentSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cloudflareDeploymentId: { type: String },
    status: { 
      type: String, 
      enum: ['QUEUED', 'BUILDING', 'READY', 'FAILED', 'CANCELED'], 
      default: 'QUEUED' 
    },
    branch: { type: String, required: true, default: 'main' },
    commitHash: { type: String },
    commitMessage: { type: String },
    url: { type: String },
    duration: { type: Number },
    environment: { type: String, default: 'Production' },
    logs: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Deployment || mongoose.model<IDeployment>('Deployment', DeploymentSchema);
