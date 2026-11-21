import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  actorName: String,
  actorEmail: String,
  actorRole: String,
  action: {
    type: String,
    required: true,
  },
  target: {
    type: String, // Can be an ObjectId string, email, or a resource name
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  targetName: String,
  entityType: String,
  entityId: String,
  entityDisplay: String,
  description: String,
  success: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Flexible object to store additional data like "fromRole", "toRole"
  },
  ipAddress: {
    type: String,
  },
}, { timestamps: true });

// Optional: Index on action or actor if you plan to search logs heavily
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ targetUser: 1 });
auditLogSchema.index({ createdAt: -1, action: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
