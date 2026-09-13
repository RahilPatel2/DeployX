import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  type: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    color: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);
