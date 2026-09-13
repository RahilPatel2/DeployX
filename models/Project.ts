import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  slug: string;
  userId: mongoose.Types.ObjectId;
  framework: string;
  repository: string; // e.g., 'owner/repo'
  branch: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  cloudflareProjectName?: string;
  productionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    framework: { type: String, default: 'Next.js' },
    repository: { type: String, required: true },
    branch: { type: String, default: 'main' },
    buildCommand: { type: String, default: 'npm run build' },
    outputDirectory: { type: String, default: '.next' },
    installCommand: { type: String, default: 'npm install' },
    cloudflareProjectName: { type: String },
    productionUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
