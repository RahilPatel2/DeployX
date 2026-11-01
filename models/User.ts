import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPreferences {
  theme?: 'system' | 'light' | 'dark';
  defaultView?: 'grid' | 'list';
  notifyOnBuildSuccess?: boolean;
  notifyOnBuildFailure?: boolean;
  notifyOnDeploymentStarted?: boolean;
  timezone?: string;
}

export interface IUserSession {
  sessionId: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  lastActive: Date;
}

export interface IMfaRecoveryCode {
  codeHash: string;
  usedAt?: Date;
}

export interface IPendingMfaEnrollment {
  secretEncrypted: string;
  expiresAt: Date;
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
  // Account & Security fields
  pendingEmail?: string;
  emailVerificationToken?: string;
  emailVerificationCode?: string;
  emailVerificationExpires?: Date;
  passwordChangedAt?: Date;
  tokenVersion?: number;
  sessions?: IUserSession[];
  // Google OAuth fields
  googleId?: string;
  googleEmail?: string;
  googleConnectedAt?: Date;
  // Two-Factor Authentication (MFA / TOTP)
  mfaEnabled?: boolean;
  mfaEnrolledAt?: Date;
  mfaSecretEncrypted?: string;
  mfaLastVerifiedAt?: Date;
  mfaLastUsedTimeStep?: number;
  mfaRecoveryCodes?: IMfaRecoveryCode[];
  pendingMfaEnrollment?: IPendingMfaEnrollment;
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
    // Account & Security fields
    pendingEmail: { type: String, lowercase: true, trim: true, maxlength: 128 },
    emailVerificationToken: { type: String },
    emailVerificationCode: { type: String },
    emailVerificationExpires: { type: Date },
    passwordChangedAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    sessions: [
      {
        sessionId: { type: String, required: true },
        userAgent: { type: String, default: 'Unknown Device' },
        ip: { type: String, default: 'Unknown IP' },
        createdAt: { type: Date, default: Date.now },
        lastActive: { type: Date, default: Date.now },
      },
    ],
    // Google OAuth fields
    googleId: { type: String, sparse: true, unique: true },
    googleEmail: { type: String, lowercase: true, trim: true },
    googleConnectedAt: { type: Date },
    // Two-Factor Authentication (MFA / TOTP)
    mfaEnabled: { type: Boolean, default: false },
    mfaEnrolledAt: { type: Date },
    mfaSecretEncrypted: { type: String },
    mfaLastVerifiedAt: { type: Date },
    mfaLastUsedTimeStep: { type: Number, default: 0 },
    mfaRecoveryCodes: [
      {
        codeHash: { type: String, required: true },
        usedAt: { type: Date },
      },
    ],
    pendingMfaEnrollment: {
      secretEncrypted: { type: String },
      expiresAt: { type: Date },
    },
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
