import { Router } from 'express';
import { globalSearch } from '../controllers/searchController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

router.use(protect, authorize(...STAFF_ROLES));
router.get('/', globalSearch);

export default router;
