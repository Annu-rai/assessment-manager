import AuditLog from '../models/AuditLog.js';

/**
 * Audit logging (Module 25). Fire-and-forget: never blocks or throws into the
 * request path — a failed audit write must not fail the user's action.
 */
export function recordAudit({ organization, actorId, actorName, actorRole, action, target = '', meta = {} }) {
  AuditLog.create({ organization, actor: actorId, actorName, actorRole, action, target, meta }).catch(
    (e) => console.warn('Audit log failed:', e.message)
  );
}

// Convenience: record an action performed by the authenticated req.user.
export function auditReq(req, action, target = '', meta = {}) {
  recordAudit({
    organization: req.user?.organization,
    actorId: req.user?.id,
    actorName: req.user?.name,
    actorRole: req.user?.role,
    action,
    target,
    meta,
  });
}
