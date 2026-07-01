import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import { getPublicAssessment, submitPublicResponse } from '../controllers/publicController.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';

// Public, unauthenticated endpoints for shared assessment links (Module 14).
const router = Router();

router.get('/assessments/:publicId', getPublicAssessment);

router.post(
  '/assessments/:publicId/submit',
  body('answers').isArray({ min: 1 }).withMessage('answers must be a non-empty array'),
  validate,
  submitPublicResponse
);

// Anonymous file upload for file/media answers on public assessments.
router.post(
  '/uploads',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error('No file was uploaded (field name must be "file")');
    }
    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  })
);

export default router;
