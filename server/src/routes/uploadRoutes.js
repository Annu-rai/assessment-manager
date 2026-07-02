import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// POST /api/uploads — single-file upload (question media, candidate answers).
// Returns a public URL the client stores as the answer/question asset.
router.post(
  '/',
  protect,
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
