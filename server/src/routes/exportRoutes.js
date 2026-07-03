import { Router } from 'express';
import { exportResponses, exportCandidates } from '../controllers/exportController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

// Exports are a staff reporting tool, scoped to the org.
router.use(protect, authorize(...STAFF_ROLES));

router.get('/responses', exportResponses);
router.get('/candidates', exportCandidates);

export default router;
