import mongoose, { Schema, Document } from 'mongoose';

export type WebhookDeliveryStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'IGNORED' | 'FAILED';

export interface IWebhookDelivery extends Document {
  deliveryId: string;
  projectId: mongoose.Types.ObjectId;
  repository: string;
  branch: string;
  commitHash: string;
  commitMessage?: string;
  sender?: string;
  event: string;
  status: WebhookDeliveryStatus;
  ignoredReason?: string;
  deploymentId?: mongoose.Types.ObjectId;
  errorMessage?: string;
  commitTimestamp?: Date;
  payloadSize?: number;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema: Schema = new Schema(
  {
    deliveryId: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    repository: { type: String, required: true, index: true },
    branch: { type: String, required: true },
    commitHash: { type: String, required: true },
    commitMessage: { type: String },
    sender: { type: String },
    event: { type: String, default: 'push' },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'IGNORED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    ignoredReason: { type: String },
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment' },
    errorMessage: { type: String },
    commitTimestamp: { type: Date },
    payloadSize: { type: Number },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

WebhookDeliverySchema.index({ projectId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ projectId: 1, branch: 1, commitTimestamp: -1 });

export default mongoose.models.WebhookDelivery ||
  mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);
