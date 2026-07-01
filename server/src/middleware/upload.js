import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Local-disk upload storage (dev-friendly, no cloud account needed).
 * Files land in server/uploads and are served statically at /uploads.
 * Swap this for S3/Cloudinary storage later without touching call sites.
 */
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Random, collision-proof name; keep the original extension.
    const ext = path.extname(file.originalname).slice(0, 10);
    const id = crypto.randomBytes(12).toString('hex');
    cb(null, `${id}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
});
