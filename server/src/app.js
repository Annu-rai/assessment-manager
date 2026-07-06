import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { notFound, errorHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import { openApiSpec } from './config/openapi.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import responseRoutes from './routes/responseRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import searchRoutes from './routes/searchRoutes.js';

/**
 * Builds the Express app WITHOUT connecting to the database or starting a
 * listener. Keeping this separate from index.js lets tests import the app and
 * drive it with supertest against an in-memory MongoDB.
 */
export function createApp() {
  
  const app = express();

  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Serve uploaded files (question media + candidate answer files).
  app.use('/uploads', express.static(UPLOAD_DIR));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', time: new Date().toISOString() })
  );

  // Interactive API docs (Module 31) — public.
  app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Assessment API Docs' }));

  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/responses', responseRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/certificates', certificateRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/search', searchRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
