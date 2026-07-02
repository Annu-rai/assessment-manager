import { Router } from 'express';
import { listCertificates, downloadCertificate } from '../controllers/certificateController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect); // candidates and staff both use certificates

router.get('/', listCertificates);
router.get('/:certificateId/download', downloadCertificate);

export default router;
