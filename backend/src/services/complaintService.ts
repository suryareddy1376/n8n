import { supabaseAdmin } from '../utils/supabase.js';
import { 
  Complaint, 
  ComplaintStatus, 
  CreateComplaintRequest,
  ComplaintFilters,
  PaginatedResponse,
  UrgencyLevel
} from '../types/index.js';
import { NotFoundError, ValidationError, handleDatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { calculatePriorityScore } from '../utils/helpers.js';
import { classifyAndProcessComplaint } from './aiClassification.js';
import { triggerComplaintRouting, triggerNotification } from './webhookService.js';

// Create a new complaint
export const createComplaint = async (
  userId: string,
  data: CreateComplaintRequest,
  imageUrls?: string[]
): Promise<Complaint> => {
  try {
    // Create initial complaint record
    const { data: complaint, error: createError } = await supabaseAdmin
      .from('complaints')
      .insert({
        user_id: userId,
        description: data.description,
        voice_transcript: data.voice_transcript,
        location_lat: data.location_lat,
        location_lng: data.location_lng,
        location_address: data.location_address,
        location_landmark: data.location_landmark,
        image_urls: imageUrls || [],
        status: 'submitted',
      })
      .select()
      .single();

    if (createError || !complaint) {
      throw handleDatabaseError(createError);
    }

    logger.info('Complaint created', { complaintId: complaint.id, userId });

    // Trigger AI classification (async - don't block response)
    processComplaintClassification(complaint.id, data, complaint.created_at).catch(
      (error) => {
        logger.error('Background classification failed', {
          complaintId: complaint.id,
          error: error.message,
        });
      }
    );

    return complaint as Complaint;
  } catch (error) {
    logger.error('Failed to create complaint', { userId, error });
    throw error;
  }
};

// Process complaint classification in background
const processComplaintClassification = async (
  complaintId: string,
  data: CreateComplaintRequest,
  createdAt: string
): Promise<void> => {
  try {
    // Run AI classification
    const result = await classifyAndProcessComplaint(
      complaintId,
      data.description,
      data.location_lat,
      data.location_lng,
      data.location_address
    );

    // Calculate priority score
    const priorityScore = calculatePriorityScore(
      result.classification.urgency,
      new Date(createdAt),
      result.isCriticalArea
    );

    // Determine new status based on confidence
    const newStatus: ComplaintStatus = result.isAutoApproved ? 'approved' : 'pending_review';

    // Update complaint with classification results
    const { error: updateError } = await supabaseAdmin
      .from('complaints')
      .update({
        department_id: result.departmentId,
        urgency: result.classification.urgency,
        ai_confidence: result.classification.confidence,
        ai_reasoning: result.classification.reasoning,
        ai_classified_at: new Date().toISOString(),
        ai_model_version: 'gemini-pro-1.0',
        is_auto_approved: result.isAutoApproved,
        status: newStatus,
        priority_score: priorityScore,
        is_critical_area: result.isCriticalArea,
        sla_deadline: result.slaDeadline?.toISOString(),
        approved_at: result.isAutoApproved ? new Date().toISOString() : null,
      })
      .eq('id', complaintId);

    if (updateError) {
      throw handleDatabaseError(updateError);
    }

    logger.info('Complaint classification completed', {
      complaintId,
      status: newStatus,
      confidence: result.classification.confidence,
      department: result.classification.department_code,
    });

    // If auto-approved, trigger routing workflow
    if (result.isAutoApproved && result.departmentId) {
      await triggerComplaintRouting(complaintId, result.departmentId);
    }
  } catch (error) {
    logger.error('Classification processing failed', { complaintId, error });

    // Update complaint to pending_review on classification failure
    await supabaseAdmin
      .from('complaints')
      .update({
        status: 'pending_review',
        ai_reasoning: 'Classification failed - requires manual review',
      })
      .eq('id', complaintId);
  }
};

// Get complaint by ID
export const getComplaintById = async (
  complaintId: string,
  userId?: string,
  userRole?: string,
  departmentId?: string
): Promise<Complaint> => {
  let query = supabaseAdmin
    .from('complaints')
    .select(`
      *,
      department:departments(id, name, code, sla_hours),
      citizen:users!complaints_user_id_fkey(id, full_name, email, phone),
      assigned_user:users!complaints_assigned_to_fkey(id, full_name, email)
    `)
    .eq('id', complaintId);

  // Apply role-based filtering
  if (userRole === 'citizen' && userId) {
    query = query.eq('user_id', userId);
  } else if (userRole === 'department' && departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new NotFoundError('Complaint', complaintId);
  }

  return data as Complaint;
};

// Get complaints with filters and pagination
export const getComplaints = async (
  filters: ComplaintFilters & { page: number; limit: number },
  userId?: string,
  userRole?: string,
  departmentId?: string
): Promise<PaginatedResponse<Complaint>> => {
  const { page, limit, status, urgency, date_from, date_to, sla_breached, search, sort_by, sort_order } = filters;

  let query = supabaseAdmin
    .from('complaints')
    .select(`
      *,
      department:departments(id, name, code),
      citizen:users!complaints_user_id_fkey(id, full_name, email)
    `, { count: 'exact' });

  // Apply role-based filtering
  if (userRole === 'citizen' && userId) {
    query = query.eq('user_id', userId);
  } else if (userRole === 'department' && departmentId) {
    query = query.eq('department_id', departmentId);
  }

  // Apply filters
  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  if (urgency) {
    if (Array.isArray(urgency)) {
      query = query.in('urgency', urgency);
    } else {
      query = query.eq('urgency', urgency);
    }
  }

  if (date_from) {
    query = query.gte('created_at', date_from);
  }

  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  if (sla_breached !== undefined) {
    query = query.eq('sla_breached', sla_breached);
  }

  if (search) {
    query = query.ilike('description', `%${search}%`);
  }

  // Sorting
  const sortColumn = sort_by || 'created_at';
  const sortAsc = sort_order === 'asc';
  query = query.order(sortColumn, { ascending: sortAsc });

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw handleDatabaseError(error);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: (data || []) as Complaint[],
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
};

// Get complaints pending review (for admin)
export const getPendingReviewComplaints = async (
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResponse<Complaint>> => {
  return getComplaints(
    { page, limit, status: 'pending_review', sort_by: 'created_at', sort_order: 'asc' },
    undefined,
    'admin'
  );
};

// Approve or reject complaint (admin only)
export const reviewComplaint = async (
  complaintId: string,
  reviewerId: string,
  approved: boolean,
  notes?: string,
  departmentId?: string,
  urgency?: UrgencyLevel
): Promise<Complaint> => {
  // Get current complaint
  const complaint = await getComplaintById(complaintId);

  if (complaint.status !== 'pending_review') {
    throw new ValidationError('Complaint is not pending review');
  }

  const updateData: Partial<Complaint> = {
    status: approved ? 'approved' : 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: notes,
  };

  if (approved) {
    updateData.approved_at = new Date().toISOString();
    updateData.is_auto_approved = false;

    if (departmentId) {
      updateData.department_id = departmentId;
    }
    if (urgency) {
      updateData.urgency = urgency;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update(updateData)
    .eq('id', complaintId)
    .select()
    .single();

  if (error) {
    throw handleDatabaseError(error);
  }

  logger.info('Complaint reviewed', {
    complaintId,
    reviewerId,
    approved,
    newStatus: updateData.status,
  });

  // If approved, trigger routing
  if (approved && (departmentId || complaint.department_id)) {
    await triggerComplaintRouting(complaintId, departmentId || complaint.department_id!);
  }

  // Notify citizen
  const notificationType = approved ? 'complaint_approved' : 'complaint_rejected';
  await triggerNotification(complaint.user_id, complaintId, notificationType);

  return data as Complaint;
};

// Update complaint status (department user)
export const updateComplaintStatus = async (
  complaintId: string,
  updaterId: string,
  status: ComplaintStatus,
  notes?: string,
  resolutionType?: string
): Promise<Complaint> => {
  const complaint = await getComplaintById(complaintId);

  // Validate status transition
  const validTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
    submitted: ['pending_review', 'approved'],
    pending_review: ['approved', 'rejected'],
    approved: ['assigned'],
    rejected: [],
    assigned: ['in_progress'],
    in_progress: ['resolved', 'escalated'],
    resolved: ['closed'],
    closed: [],
    escalated: ['in_progress', 'resolved'],
  };

  if (!validTransitions[complaint.status]?.includes(status)) {
    throw new ValidationError(
      `Cannot transition from ${complaint.status} to ${status}`
    );
  }

  const updateData: Partial<Complaint> = {
    status,
  };

  if (status === 'resolved') {
    updateData.resolved_at = new Date().toISOString();
    updateData.resolution_notes = notes;
    updateData.resolution_type = resolutionType;
  }

  if (status === 'closed') {
    updateData.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update(updateData)
    .eq('id', complaintId)
    .select()
    .single();

  if (error) {
    throw handleDatabaseError(error);
  }

  // Log status change
  await supabaseAdmin.from('complaint_status_logs').insert({
    complaint_id: complaintId,
    old_status: complaint.status,
    new_status: status,
    changed_by: updaterId,
    change_reason: notes,
  });

  logger.info('Complaint status updated', {
    complaintId,
    oldStatus: complaint.status,
    newStatus: status,
    updaterId,
  });

  // Notify citizen of status change
  await triggerNotification(complaint.user_id, complaintId, 'status_updated');

  return data as Complaint;
};

// Assign complaint to user
export const assignComplaint = async (
  complaintId: string,
  assignedTo?: string
): Promise<Complaint> => {
  const updateData: Partial<Complaint> = {
    status: 'assigned',
    assigned_at: new Date().toISOString(),
    assigned_to: assignedTo,
  };

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update(updateData)
    .eq('id', complaintId)
    .select()
    .single();

  if (error) {
    throw handleDatabaseError(error);
  }

  logger.info('Complaint assigned', { complaintId, assignedTo });

  return data as Complaint;
};

// Add citizen feedback
export const addCitizenFeedback = async (
  complaintId: string,
  userId: string,
  rating: number,
  feedbackText?: string
): Promise<Complaint> => {
  const complaint = await getComplaintById(complaintId, userId, 'citizen');

  if (!['resolved', 'closed'].includes(complaint.status)) {
    throw new ValidationError('Can only provide feedback on resolved complaints');
  }

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update({
      citizen_feedback_rating: rating,
      citizen_feedback_text: feedbackText,
    })
    .eq('id', complaintId)
    .select()
    .single();

  if (error) {
    throw handleDatabaseError(error);
  }

  logger.info('Citizen feedback added', { complaintId, rating });

  return data as Complaint;
};

// Get complaint timeline/status history
export const getComplaintTimeline = async (
  complaintId: string
): Promise<{ status_logs: unknown[]; escalations: unknown[] }> => {
  const [statusLogs, escalations] = await Promise.all([
    supabaseAdmin
      .from('complaint_status_logs')
      .select('*, changed_by_user:users!complaint_status_logs_changed_by_fkey(full_name)')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('escalations')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true }),
  ]);

  return {
    status_logs: statusLogs.data || [],
    escalations: escalations.data || [],
  };
};

export default {
  createComplaint,
  getComplaintById,
  getComplaints,
  getPendingReviewComplaints,
  reviewComplaint,
  updateComplaintStatus,
  assignComplaint,
  addCitizenFeedback,
  getComplaintTimeline,
};
