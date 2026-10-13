import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPreferences {
  theme?: 'system' | 'light' | 'dark';
  defaultView?: 'grid' | 'list';
  notifyOnBuildSuccess?: boolean;
  notifyOnBuildFailure?: boolean;
  notifyOnDeploymentStarted?: boolean;
  timezone?: string;
}

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'disabled';
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerified?: Date;
  avatar?: string;
  bio?: string;
  phone?: string;
  lastLogin?: Date;
  preferences?: IUserPreferences;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 64 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 32 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 128 },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    role: { type: String, default: 'user' },
    emailVerified: { type: Date },
    avatar: { type: String },
    bio: { type: String, default: "", maxlength: 500 },
    phone: { type: String, default: "", maxlength: 32 },
    lastLogin: { type: Date },
    preferences: {
      theme: { type: String, enum: ['system', 'light', 'dark'], default: 'dark' },
      defaultView: { type: String, enum: ['grid', 'list'], default: 'grid' },
      notifyOnBuildSuccess: { type: Boolean, default: true },
      notifyOnBuildFailure: { type: Boolean, default: true },
      notifyOnDeploymentStarted: { type: Boolean, default: false },
      timezone: { type: String, default: 'UTC' },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
