import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import Certificate from '../models/Certificate.js';

/**
 * Certificate helpers (Module 17). Issues a certificate when a submission is a
 * graded pass, renders it as a PDF, and builds the public verification URL.
 */

// Front-end origin used for the QR / verification link.
export function verifyBaseUrl(req) {
  const fromEnv = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim();
  if (fromEnv) return fromEnv;
  return `${req.protocol}://${req.get('host')}`;
}

// Create a certificate for a passed response (idempotent per response).
export async function maybeIssueCertificate({ response, assessment, user }) {
  if (!response.graded || !response.passed) return null;
  const existing = await Certificate.findOne({ response: response._id });
  if (existing) return existing;
  return Certificate.create({
    organization: response.organization,
    response: response._id,
    assessment: assessment._id,
    assessmentTitle: assessment.title,
    candidate: user._id,
    candidateName: user.name,
    candidateEmail: user.email,
    percentage: response.percentage,
    certificateId: crypto.randomBytes(9).toString('base64url'),
  });
}

/**
 * Stream a certificate PDF (with a verification QR code) to an Express response.
 */
export async function streamCertificatePdf(cert, req, res) {
  const verifyUrl = `${verifyBaseUrl(req)}/verify/${cert.certificateId}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="certificate-${cert.certificateId}.pdf"`);
  doc.pipe(res);

  const { width } = doc.page;
  const cx = width / 2;

  // Border
  doc.lineWidth(3).strokeColor('#4f46e5').rect(30, 30, width - 60, doc.page.height - 60).stroke();
  doc.lineWidth(1).strokeColor('#c7d2fe').rect(42, 42, width - 84, doc.page.height - 84).stroke();

  doc.fillColor('#4f46e5').fontSize(34).font('Helvetica-Bold').text('Certificate of Achievement', 0, 90, {
    align: 'center',
  });
  doc.moveDown(0.6);
  doc.fillColor('#374151').fontSize(14).font('Helvetica').text('This is proudly presented to', { align: 'center' });
  doc.moveDown(0.4);
  doc.fillColor('#111827').fontSize(28).font('Helvetica-Bold').text(cert.candidateName || 'Candidate', {
    align: 'center',
  });
  doc.moveDown(0.5);
  doc
    .fillColor('#374151')
    .fontSize(14)
    .font('Helvetica')
    .text(`for successfully passing "${cert.assessmentTitle}"`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor('#16a34a').fontSize(18).font('Helvetica-Bold').text(`Score: ${cert.percentage}%`, {
    align: 'center',
  });

  // QR + verification text
  const qrY = doc.page.height - 170;
  doc.image(qrBuffer, cx - 55, qrY, { width: 110 });
  doc
    .fillColor('#6b7280')
    .fontSize(9)
    .font('Helvetica')
    .text(`Verify at ${verifyUrl}`, 0, qrY + 115, { align: 'center' });
  doc
    .fontSize(9)
    .text(`Certificate ID: ${cert.certificateId}  ·  Issued ${new Date(cert.createdAt).toDateString()}`, {
      align: 'center',
    });

  doc.end();
}
