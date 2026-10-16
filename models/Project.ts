import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  slug: string;
  userId: mongoose.Types.ObjectId;
  framework: string;
  repository: string; // e.g., 'owner/repo'
  repositoryId?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  repositoryVisibility?: 'public' | 'private';
  defaultBranch?: string;
  branch: string;
  rootDirectory?: string;
  packageManager?: string;
  deploymentMode?: 'static' | 'ssr';
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  cloudflareProjectName?: string;
  productionUrl?: string;
  autoDeploy?: boolean;
  webhookSecret?: string;
  githubWebhookId?: number;
  webhookStatus?: 'active' | 'inactive' | 'manual' | 'failed';
  lastWebhookPayloadAt?: Date;
  lastWebhookDeliveryId?: string;
  lastWebhookStatus?: 'success' | 'failed' | 'ignored';
  lastWebhookError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    framework: { type: String, default: 'Next.js' },
    repository: { type: String, required: true },
    repositoryId: { type: Number },
    repositoryOwner: { type: String },
    repositoryName: { type: String },
    repositoryVisibility: { type: String, enum: ['public', 'private'], default: 'public' },
    defaultBranch: { type: String, default: 'main' },
    branch: { type: String, default: 'main' },
    rootDirectory: { type: String, default: '' },
    packageManager: { type: String, enum: ['npm', 'pnpm', 'yarn', 'bun'], default: 'npm' },
    deploymentMode: { type: String, enum: ['static', 'ssr'], default: 'static' },
    buildCommand: { type: String, default: 'npm run build' },
    outputDirectory: { type: String, default: '.next' },
    installCommand: { type: String, default: 'npm install' },
    cloudflareProjectName: { type: String },
    productionUrl: { type: String },
    autoDeploy: { type: Boolean, default: true },
    webhookSecret: { type: String },
    githubWebhookId: { type: Number },
    webhookStatus: {
      type: String,
      enum: ['active', 'inactive', 'manual', 'failed'],
      default: 'inactive',
    },
    lastWebhookPayloadAt: { type: Date },
    lastWebhookDeliveryId: { type: String },
    lastWebhookStatus: { type: String, enum: ['success', 'failed', 'ignored'] },
    lastWebhookError: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProjectSchema.index({ userId: 1, createdAt: -1 });
ProjectSchema.index({ userId: 1, framework: 1, createdAt: -1 });
ProjectSchema.index({ userId: 1, slug: 1 });
ProjectSchema.index({ userId: 1, repository: 1 });
ProjectSchema.index({ repository: 1 });

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
