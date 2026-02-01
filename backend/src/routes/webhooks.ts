import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, webhookPayloadSchema } from '../middleware/validation.js';
import { verifyWebhookSignature } from '../services/webhookService.js';
import slaService from '../services/slaService.js';
import complaintService from '../services/complaintService.js';
import { WebhookError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();

// Webhook authentication middleware
const verifyWebhook = (req: Request, _res: Response, next: NextFunction) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const secret = req.headers['x-webhook-secret'] as string;

  // Verify secret token
  if (secret !== config.security.webhookSecret) {
    if (!signature) {
      throw new WebhookError('Missing webhook signature or secret');
    }
    
    // Verify HMAC signature
    const isValid = verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      throw new WebhookError('Invalid webhook signature');
    }
  }

  next();
};

/**
 * @route   POST /api/v1/webhooks/n8n
 * @desc    Receive webhook calls from n8n
 * @access  Webhook (secured with secret)
 */
router.post(
  '/n8n',
  verifyWebhook,
  validate(webhookPayloadSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { event_type, complaint_id, data } = req.body;

    logger.info('Received n8n webhook', { event_type, complaint_id });

    switch (event_type) {
      case 'complaint_assigned':
        // n8n confirms assignment
        if (data.assigned_to) {
          await complaintService.assignComplaint(complaint_id, data.assigned_to as string);
        }
        break;

      case 'status_update':
        // n8n requests status update
        if (data.status && data.updated_by) {
          await complaintService.updateComplaintStatus(
            complaint_id,
            data.updated_by as string,
            data.status as Parameters<typeof complaintService.updateComplaintStatus>[2],
            data.notes as string
          );
        }
        break;

      case 'escalation_acknowledged':
        // n8n confirms escalation acknowledgment
        if (data.escalation_id && data.acknowledged_by) {
          await slaService.acknowledgeEscalation(
            data.escalation_id as string,
            data.acknowledged_by as string
          );
        }
        break;

      case 'notification_sent':
        // n8n confirms notification was sent
        logger.info('Notification confirmed sent', { complaint_id, channel: data.channel });
        break;

      default:
        logger.warn('Unknown webhook event type', { event_type });
    }

    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

/**
 * @route   POST /api/v1/webhooks/sla-check
 * @desc    Trigger SLA check (called by n8n scheduled workflow)
 * @access  Webhook (secured with secret)
 */
router.post(
  '/sla-check',
  verifyWebhook,
  asyncHandler(async (_req, res) => {
    const result = await slaService.checkSLABreaches();

    res.json({
      success: true,
      data: result,
      message: 'SLA check completed',
    });
  })
);

/**
 * @route   GET /api/v1/webhooks/health
 * @desc    Webhook endpoint health check
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route   POST /api/v1/internal/sla-check
 * @desc    Manual SLA check trigger (admin only)
 * @access  Admin
 */
router.post(
  '/internal/sla-check',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const result = await slaService.checkSLABreaches();

    res.json({
      success: true,
      data: result,
      message: 'SLA check completed',
    });
  })
);

export default router;
