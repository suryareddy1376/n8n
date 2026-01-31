import { supabaseAdmin } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { handleDatabaseError } from '../utils/errors.js';
import { triggerSLAWarning, triggerSLABreach } from './webhookService.js';
import { config } from '../config/index.js';

// Escalation levels in order
const ESCALATION_ORDER = ['level_1', 'level_2', 'level_3', 'executive'] as const;

// Check and process SLA breaches
export const checkSLABreaches = async (): Promise<{
  checked: number;
  warnings: number;
  breaches: number;
  escalations: number;
}> => {
  const startTime = Date.now();
  let warnings = 0;
  let breaches = 0;
  let escalations = 0;

  try {
    // Get all complaints that are not resolved/closed and have SLA deadline
    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('id, sla_deadline, sla_breached, sla_breach_notified, status, urgency')
      .not('status', 'in', '("resolved","closed","rejected")')
      .not('sla_deadline', 'is', null);

    if (error) {
      throw handleDatabaseError(error);
    }

    const now = new Date();
    const warningThreshold = config.sla.warningHoursBefore * 60 * 60 * 1000;

    for (const complaint of complaints || []) {
      const deadline = new Date(complaint.sla_deadline);
      const timeUntilDeadline = deadline.getTime() - now.getTime();

      // Check for SLA breach
      if (timeUntilDeadline < 0 && !complaint.sla_breached) {
        await handleSLABreach(complaint.id);
        breaches++;
      }
      // Check for SLA warning (approaching deadline)
      else if (
        timeUntilDeadline > 0 &&
        timeUntilDeadline < warningThreshold &&
        !complaint.sla_breach_notified
      ) {
        await handleSLAWarning(complaint.id);
        warnings++;
      }

      // Check for escalation of already breached complaints
      if (complaint.sla_breached && complaint.status !== 'escalated') {
        const hoursOverdue = Math.abs(timeUntilDeadline) / (1000 * 60 * 60);
        const shouldEscalate = await checkEscalation(complaint.id, hoursOverdue);
        if (shouldEscalate) {
          escalations++;
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info('SLA check completed', {
      checked: complaints?.length || 0,
      warnings,
      breaches,
      escalations,
      duration: `${duration}ms`,
    });

    return {
      checked: complaints?.length || 0,
      warnings,
      breaches,
      escalations,
    };
  } catch (error) {
    logger.error('SLA check failed', { error });
    throw error;
  }
};

// Handle SLA warning (approaching deadline)
const handleSLAWarning = async (complaintId: string): Promise<void> => {
  try {
    // Mark as notified
    await supabaseAdmin
      .from('complaints')
      .update({ sla_breach_notified: true })
      .eq('id', complaintId);

    // Trigger warning notification
    await triggerSLAWarning(complaintId);

    logger.info('SLA warning sent', { complaintId });
  } catch (error) {
    logger.error('Failed to handle SLA warning', { complaintId, error });
  }
};

// Handle SLA breach
const handleSLABreach = async (complaintId: string): Promise<void> => {
  try {
    // Update complaint as breached
    await supabaseAdmin
      .from('complaints')
      .update({
        sla_breached: true,
        sla_breach_notified: true,
        status: 'escalated',
      })
      .eq('id', complaintId);

    // Create initial escalation record
    await supabaseAdmin.from('escalations').insert({
      complaint_id: complaintId,
      escalation_level: 'level_1',
      previous_level: null,
      reason: 'SLA deadline exceeded',
      is_system_escalation: true,
    });

    // Trigger breach notification
    await triggerSLABreach(complaintId, 'level_1');

    logger.info('SLA breach processed', { complaintId, level: 'level_1' });
  } catch (error) {
    logger.error('Failed to handle SLA breach', { complaintId, error });
  }
};

// Check if complaint needs further escalation
const checkEscalation = async (
  complaintId: string,
  hoursOverdue: number
): Promise<boolean> => {
  try {
    // Get current escalation level
    const { data: latestEscalation } = await supabaseAdmin
      .from('escalations')
      .select('escalation_level, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestEscalation) {
      return false;
    }

    const currentLevel = latestEscalation.escalation_level;
    const currentIndex = ESCALATION_ORDER.indexOf(currentLevel as typeof ESCALATION_ORDER[number]);

    // Already at highest level
    if (currentIndex >= ESCALATION_ORDER.length - 1) {
      return false;
    }

    // Determine if escalation is needed based on time
    const escalationThresholds: Record<string, number> = {
      level_1: 24, // Escalate to level_2 after 24 hours overdue
      level_2: 48, // Escalate to level_3 after 48 hours overdue
      level_3: 72, // Escalate to executive after 72 hours overdue
    };

    const threshold = escalationThresholds[currentLevel];
    if (hoursOverdue < threshold) {
      return false;
    }

    // Check time since last escalation (minimum 12 hours between escalations)
    const hoursSinceEscalation =
      (Date.now() - new Date(latestEscalation.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceEscalation < 12) {
      return false;
    }

    // Escalate to next level
    const nextLevel = ESCALATION_ORDER[currentIndex + 1];
    await escalateComplaint(complaintId, currentLevel, nextLevel);

    return true;
  } catch (error) {
    logger.error('Escalation check failed', { complaintId, error });
    return false;
  }
};

// Escalate complaint to next level
const escalateComplaint = async (
  complaintId: string,
  previousLevel: string,
  newLevel: string
): Promise<void> => {
  try {
    // Create escalation record
    await supabaseAdmin.from('escalations').insert({
      complaint_id: complaintId,
      escalation_level: newLevel,
      previous_level: previousLevel,
      reason: `Automatic escalation due to continued SLA breach (${previousLevel} -> ${newLevel})`,
      is_system_escalation: true,
    });

    // Trigger escalation notification
    await triggerSLABreach(complaintId, newLevel);

    logger.info('Complaint escalated', {
      complaintId,
      from: previousLevel,
      to: newLevel,
    });
  } catch (error) {
    logger.error('Failed to escalate complaint', { complaintId, error });
  }
};

// Get escalation history for a complaint
export const getEscalationHistory = async (complaintId: string) => {
  const { data, error } = await supabaseAdmin
    .from('escalations')
    .select(`
      *,
      escalated_to_user:users!escalations_escalated_to_fkey(id, full_name, email),
      acknowledged_by_user:users!escalations_acknowledged_by_fkey(id, full_name)
    `)
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: false });

  if (error) {
    throw handleDatabaseError(error);
  }

  return data;
};

// Acknowledge escalation
export const acknowledgeEscalation = async (
  escalationId: string,
  userId: string
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('escalations')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq('id', escalationId);

  if (error) {
    throw handleDatabaseError(error);
  }

  logger.info('Escalation acknowledged', { escalationId, userId });
};

// Get SLA statistics
export const getSLAStatistics = async (departmentId?: string) => {
  let query = supabaseAdmin
    .from('complaints')
    .select('sla_breached, resolved_at, created_at, sla_deadline', { count: 'exact' })
    .not('status', 'in', '("submitted","pending_review")');

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, count, error } = await query;

  if (error) {
    throw handleDatabaseError(error);
  }

  const total = count || 0;
  const breached = data?.filter((c) => c.sla_breached).length || 0;
  const resolved = data?.filter((c) => c.resolved_at).length || 0;
  const resolvedOnTime = data?.filter((c) => c.resolved_at && !c.sla_breached).length || 0;

  return {
    total_complaints: total,
    sla_breached: breached,
    sla_compliance_rate: total > 0 ? ((total - breached) / total) * 100 : 100,
    resolved_on_time: resolvedOnTime,
    resolution_rate: total > 0 ? (resolved / total) * 100 : 0,
  };
};

export default {
  checkSLABreaches,
  getEscalationHistory,
  acknowledgeEscalation,
  getSLAStatistics,
};
