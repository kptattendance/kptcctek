// src/models/AuditLog.js
// Append-only trail of who changed what. Money and approvals are never
// edited silently: every create/update/approve/cancel writes one entry.

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorEmail: { type: String, default: "" },
    action: { type: String, required: true }, // "project.create", "bill.approve", ...
    entity: { type: String, required: true }, // "Project", "Bill", ...
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    note: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

// Block edits and deletes at the model level.
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  auditLogSchema.pre(op, function () {
    throw new Error("Audit log entries cannot be changed.");
  });
}

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export async function audit(req, { action, entity, entityId, before = null, after = null, note = "" }, session) {
  await AuditLog.create(
    [
      {
        actor: req.user.dbId,
        actorEmail: req.user.email,
        action,
        entity,
        entityId,
        before,
        after,
        note,
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      },
    ],
    { session }
  );
}

export default AuditLog;
