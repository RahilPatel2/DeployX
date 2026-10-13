import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  deploymentAlerts: boolean;
  securityAlerts: boolean;
  telemetry: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingsSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    emailNotifications: { type: Boolean, default: true },
    deploymentAlerts: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    telemetry: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.UserSettings || mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);
