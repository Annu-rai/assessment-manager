import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

// Dashboard KPIs are a staff view; candidates use their own portal instead.
router.use(protect, authorize(...STAFF_ROLES));

router.get('/', getDashboard);

export default router;
