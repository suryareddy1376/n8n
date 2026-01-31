import { Router } from 'express';
import complaintsRouter from './complaints.js';
import departmentsRouter from './departments.js';
import usersRouter from './users.js';
import analyticsRouter from './analytics.js';
import webhooksRouter from './webhooks.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Mount route modules
router.use('/complaints', complaintsRouter);
router.use('/departments', departmentsRouter);
router.use('/users', usersRouter);
router.use('/analytics', analyticsRouter);
router.use('/webhooks', webhooksRouter);

export default router;
