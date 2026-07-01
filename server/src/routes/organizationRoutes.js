import { Router } from 'express';
import {
  getMyOrganization,
  updateMyOrganization,
  listOrganizations,
} from '../controllers/organizationController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ADMIN_ROLES, ROLES } from '../config/roles.js';

const router = Router();

router.use(protect);

router.get('/me', getMyOrganization);
router.put('/me', authorize(...ADMIN_ROLES), updateMyOrganization);
router.get('/', authorize(ROLES.SUPER_ADMIN), listOrganizations);

export default router;
