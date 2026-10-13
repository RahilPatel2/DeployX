import mongoose, { Schema, Document } from 'mongoose';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED' | 'CANCELED';

export interface BuildConfigSnapshot {
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  rootDirectory?: string;
  framework?: string;
}

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
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  previousDeploymentId?: mongoose.Types.ObjectId;
  trigger?: 'manual' | 'redeploy' | 'webhook';
  buildConfigSnapshot?: BuildConfigSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  QUEUED: ['BUILDING', 'CANCELED', 'FAILED'],
  BUILDING: ['READY', 'FAILED', 'CANCELED'],
  READY: [],
  FAILED: [],
  CANCELED: [],
};

export function isValidDeploymentTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const DeploymentSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    previousDeploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment' },
    trigger: { type: String, enum: ['manual', 'redeploy', 'webhook'], default: 'manual' },
    buildConfigSnapshot: {
      buildCommand: { type: String },
      outputDirectory: { type: String },
      installCommand: { type: String },
      rootDirectory: { type: String },
      framework: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeploymentSchema.index({ userId: 1, createdAt: -1 });
DeploymentSchema.index({ projectId: 1, createdAt: -1 });
DeploymentSchema.index({ cloudflareDeploymentId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Deployment || mongoose.model<IDeployment>('Deployment', DeploymentSchema);
