import asyncHandler from 'express-async-handler';
import Certificate from '../models/Certificate.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';
import { streamCertificatePdf } from '../utils/certificateService.js';

// GET /api/certificates — candidate sees own; staff see the org's.
export const listCertificates = asyncHandler(async (req, res) => {
  const filter = req.user.role === ROLES.CANDIDATE ? { candidate: req.user.id } : orgFilter(req);
  const certs = await Certificate.find(filter).sort('-createdAt');
  res.json(certs);
});

// GET /api/certificates/:certificateId/download — the PDF (owner or same-org staff).
export const downloadCertificate = asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId });
  if (!cert) {
    res.status(404);
    throw new Error('Certificate not found');
  }
  const isOwner = String(cert.candidate) === String(req.user.id);
  const sameOrg =
    req.user.role === ROLES.SUPER_ADMIN || String(cert.organization) === String(req.user.organization);
  if (!isOwner && !sameOrg) {
    res.status(403);
    throw new Error('Not allowed to download this certificate');
  }
  await streamCertificatePdf(cert, req, res);
});
