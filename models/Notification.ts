import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'deployment' | 'security' | 'system' | 'project';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  read: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['info', 'success', 'warning', 'error'], 
      default: 'info' 
    },
    category: {
      type: String,
      enum: ['deployment', 'security', 'system', 'project'],
      default: 'system',
    },
    read: { type: Boolean, default: false },
    link: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast, scalable queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, category: 1 });

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
