import mongoose, { Schema, Document } from "mongoose";

export interface IEnvironmentVariable extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  key: string;
  value: string;
  targetEnvironments: string[];
  createdAt: Date;
  updatedAt: Date;
}

const EnvironmentVariableSchema = new Schema<IEnvironmentVariable>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true },
    targetEnvironments: {
      type: [String],
      enum: ["production", "preview", "development"],
      default: ["production", "preview", "development"],
    },
  },
  {
    timestamps: true,
  }
);

EnvironmentVariableSchema.index({ userId: 1, projectId: 1, key: 1 }, { unique: true });

export default mongoose.models.EnvironmentVariable ||
  mongoose.model<IEnvironmentVariable>("EnvironmentVariable", EnvironmentVariableSchema);
