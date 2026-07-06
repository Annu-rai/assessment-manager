import { Router } from 'express';
import { listAudit } from '../controllers/auditController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ADMIN_ROLES } from '../config/roles.js';

const router = Router();

// Audit trail is an admin-only view.
router.use(protect, authorize(...ADMIN_ROLES));

router.get('/', listAudit);

export default router;
