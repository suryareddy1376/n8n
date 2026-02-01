import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { ExternalServiceError } from '../utils/errors.js';
import crypto from 'crypto';

// Webhook event types
export type WebhookEventType =
  | 'complaint_created'
  | 'complaint_approved'
  | 'complaint_rejected'
  | 'complaint_assigned'
  | 'complaint_routing'
  | 'status_updated'
  | 'sla_warning'
  | 'sla_breach'
  | 'escalation_created'
  | 'notification';

// Webhook payload interface
interface WebhookPayload {
  event_type: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

// Generate HMAC signature for webhook payload
const generateSignature = (payload: Record<string, unknown>): string => {
  const hmac = crypto.createHmac('sha256', config.n8n.webhookSecret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
};

// Verify incoming webhook signature
export const verifyWebhookSignature = (
  payload: Record<string, unknown>,
  signature: string
): boolean => {
  const expectedSignature = generateSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// Send webhook to n8n
const sendWebhook = async (
  endpoint: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> => {
  const startTime = Date.now();
  const url = `${config.n8n.webhookBaseUrl}/${endpoint}`;

  const payloadData = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  const signature = generateSignature(payloadData);
  const payload: WebhookPayload = {
    ...payloadData,
    signature,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
      },
      body: JSON.stringify(payload),
    });

    const duration = Date.now() - startTime;
    const responseBody = await response.json().catch(() => ({})) as Record<string, unknown>;

    // Log webhook call
    await logWebhook(eventType, payload, response.status, responseBody, duration);

    if (!response.ok) {
      throw new ExternalServiceError(
        'n8n',
        `Webhook failed with status ${response.status}`
      );
    }

    logger.info('Webhook sent successfully', {
      endpoint,
      eventType,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logWebhook(
      eventType,
      payload,
      0,
      { error: error instanceof Error ? error.message : 'Unknown error' },
      duration,
      error instanceof Error ? error.message : 'Unknown error'
    );

    logger.error('Webhook failed', {
      endpoint,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    });

    // Don't throw - webhook failures shouldn't break main flow
  }
};

// Log webhook to database
const logWebhook = async (
  webhookType: string,
  payload: WebhookPayload,
  responseStatus: number,
  responseBody: Record<string, unknown>,
  durationMs: number,
  errorMessage?: string
): Promise<void> => {
  try {
    await supabaseAdmin.from('webhook_logs').insert({
      webhook_type: webhookType,
      payload,
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      error_message: errorMessage,
    });
  } catch (error) {
    logger.error('Failed to log webhook', { error });
  }
};

// =====================================================
// Webhook Trigger Functions
// =====================================================

// Trigger complaint routing workflow
export const triggerComplaintRouting = async (
  complaintId: string,
  departmentId: string
): Promise<void> => {
  // Get complaint details
  const { data: complaint } = await supabaseAdmin
    .from('complaints')
    .select(`
      *,
      department:departments(id, name, code, escalation_email),
      citizen:users!complaints_user_id_fkey(id, full_name, email, phone)
    `)
    .eq('id', complaintId)
    .single();

  if (!complaint) {
    logger.error('Complaint not found for routing', { complaintId });
    return;
  }

  // Send data with both 'data' and 'payload' keys for n8n compatibility
  await sendWebhook('complaint-routing', 'complaint_routing', {
    complaint_id: complaintId,
    department_id: departmentId,
    department_name: complaint.department?.name,
    department_code: complaint.department?.code,
    department_email: complaint.department?.escalation_email,
    urgency: complaint.urgency,
    priority_score: complaint.priority_score,
    ai_confidence: complaint.ai_confidence,
    is_critical_area: complaint.is_critical_area || false,
    is_auto_approved: complaint.is_auto_approved || false,
    description: complaint.description,
    location_address: complaint.location_address,
    citizen_name: complaint.citizen?.full_name,
    citizen_email: complaint.citizen?.email,
    citizen_phone: complaint.citizen?.phone,
    sla_deadline: complaint.sla_deadline,
    created_at: complaint.created_at,
    status: complaint.status,
  });
};

// Trigger notification workflow
export const triggerNotification = async (
  userId: string,
  complaintId: string,
  notificationType: WebhookEventType
): Promise<void> => {
  // Get user and complaint details
  const [userResult, complaintResult] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', userId).single(),
    supabaseAdmin
      .from('complaints')
      .select('*, department:departments(name)')
      .eq('id', complaintId)
      .single(),
  ]);

  if (!userResult.data || !complaintResult.data) {
    logger.error('User or complaint not found for notification', {
      userId,
      complaintId,
    });
    return;
  }

  const user = userResult.data;
  const complaint = complaintResult.data;

  // Create notification record
  const notificationData = {
    user_id: userId,
    complaint_id: complaintId,
    title: getNotificationTitle(notificationType),
    message: getNotificationMessage(notificationType, complaint),
    channel: 'email' as const,
  };

  await supabaseAdmin.from('notifications').insert(notificationData);

  // Trigger n8n workflow
  await sendWebhook('notification', 'notification', {
    notification_type: notificationType,
    user_id: userId,
    user_email: user.email,
    user_name: user.full_name,
    user_phone: user.phone,
    complaint_id: complaintId,
    complaint_status: complaint.status,
    department_name: complaint.department?.name,
    message: notificationData.message,
  });
};

// Trigger SLA warning notification
export const triggerSLAWarning = async (complaintId: string): Promise<void> => {
  const { data: complaint } = await supabaseAdmin
    .from('complaints')
    .select(`
      *,
      department:departments(id, name, escalation_email),
      citizen:users!complaints_user_id_fkey(id, email),
      assigned_user:users!complaints_assigned_to_fkey(id, email)
    `)
    .eq('id', complaintId)
    .single();

  if (!complaint) {
    return;
  }

  await sendWebhook('sla-warning', 'sla_warning', {
    complaint_id: complaintId,
    department_id: complaint.department_id,
    department_name: complaint.department?.name,
    department_email: complaint.department?.escalation_email,
    assigned_to_email: complaint.assigned_user?.email,
    sla_deadline: complaint.sla_deadline,
    urgency: complaint.urgency,
    hours_remaining: calculateHoursRemaining(complaint.sla_deadline),
  });
};

// Trigger SLA breach escalation
export const triggerSLABreach = async (
  complaintId: string,
  escalationLevel: string
): Promise<void> => {
  const { data: complaint } = await supabaseAdmin
    .from('complaints')
    .select(`
      *,
      department:departments(id, name, escalation_email),
      citizen:users!complaints_user_id_fkey(id, email, full_name)
    `)
    .eq('id', complaintId)
    .single();

  if (!complaint) {
    return;
  }

  await sendWebhook('sla-breach', 'sla_breach', {
    complaint_id: complaintId,
    department_id: complaint.department_id,
    department_name: complaint.department?.name,
    department_email: complaint.department?.escalation_email,
    escalation_level: escalationLevel,
    sla_deadline: complaint.sla_deadline,
    hours_overdue: calculateHoursOverdue(complaint.sla_deadline),
    citizen_email: complaint.citizen?.email,
    citizen_name: complaint.citizen?.full_name,
    urgency: complaint.urgency,
    description: complaint.description?.substring(0, 200),
  });

  // Notify citizen of escalation
  await triggerNotification(complaint.user_id, complaintId, 'escalation_created');
};

// Helper functions
const getNotificationTitle = (type: WebhookEventType): string => {
  const titles: Record<WebhookEventType, string> = {
    complaint_created: 'Complaint Submitted',
    complaint_approved: 'Complaint Approved',
    complaint_rejected: 'Complaint Rejected',
    complaint_assigned: 'Complaint Assigned',
    complaint_routing: 'Complaint Routed',
    status_updated: 'Status Update',
    sla_warning: 'SLA Warning',
    sla_breach: 'Complaint Escalated',
    escalation_created: 'Complaint Escalated',
    notification: 'Notification',
  };
  return titles[type] || 'Notification';
};

const getNotificationMessage = (
  type: WebhookEventType,
  complaint: Record<string, unknown>
): string => {
  const messages: Record<WebhookEventType, string> = {
    complaint_created: `Your complaint has been submitted successfully and is being processed.`,
    complaint_approved: `Your complaint has been approved and assigned to ${(complaint.department as { name: string })?.name || 'the appropriate department'}.`,
    complaint_rejected: `Your complaint has been reviewed and could not be processed. Please check the details.`,
    complaint_assigned: `Your complaint has been assigned to a department officer.`,
    complaint_routing: `Your complaint is being routed to the correct department.`,
    status_updated: `Your complaint status has been updated to: ${complaint.status}`,
    sla_warning: `Your complaint is approaching its resolution deadline.`,
    sla_breach: `Your complaint has been escalated due to delayed resolution.`,
    escalation_created: `Your complaint has been escalated to ensure faster resolution.`,
    notification: `You have a new notification regarding your complaint.`,
  };
  return messages[type] || 'You have a new notification.';
};

const calculateHoursRemaining = (deadline: string | null): number => {
  if (!deadline) return 0;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60) * 10) / 10);
};

const calculateHoursOverdue = (deadline: string | null): number => {
  if (!deadline) return 0;
  const diff = Date.now() - new Date(deadline).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60) * 10) / 10);
};

export default {
  verifyWebhookSignature,
  triggerComplaintRouting,
  triggerNotification,
  triggerSLAWarning,
  triggerSLABreach,
};
