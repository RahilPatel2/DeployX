import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
  emailVerified?: Date;
  avatar?: string;
  bio?: string;
  phone?: string;
  lastLogin?: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 64 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 32 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 128 },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    emailVerified: { type: Date },
    avatar: { type: String },
    bio: { type: String, default: "", maxlength: 500 },
    phone: { type: String, default: "", maxlength: 32 },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
