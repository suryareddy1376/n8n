// =====================================================
// Type Definitions - Digital Complaint Management System
// =====================================================

// Database Enums
export type UserRole = 'citizen' | 'department' | 'admin';

export type ComplaintStatus =
  | 'submitted'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type UrgencyLevel = 'normal' | 'high' | 'critical';

export type EscalationLevel = 'level_1' | 'level_2' | 'level_3' | 'executive';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push';

// Database Models
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  sla_hours: number;
  escalation_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  description: string;
  voice_transcript: string | null;
  image_urls: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  location_landmark: string | null;
  department_id: string | null;
  urgency: UrgencyLevel;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_classified_at: string | null;
  ai_model_version: string | null;
  is_auto_approved: boolean;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  status: ComplaintStatus;
  priority_score: number;
  is_critical_area: boolean;
  resolution_notes: string | null;
  resolution_type: string | null;
  citizen_feedback_rating: number | null;
  citizen_feedback_text: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_breach_notified: boolean;
  created_at: string;
  approved_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface ComplaintStatusLog {
  id: string;
  complaint_id: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  changed_by: string | null;
  change_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Escalation {
  id: string;
  complaint_id: string;
  escalation_level: EscalationLevel;
  previous_level: EscalationLevel | null;
  reason: string;
  escalated_to: string | null;
  escalated_by: string | null;
  is_system_escalation: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution_deadline: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  title: string;
  message: string;
  channel: NotificationChannel;
  is_read: boolean;
  read_at: string | null;
  sent_at: string | null;
  send_status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CriticalArea {
  id: string;
  name: string;
  description: string | null;
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
  priority_multiplier: number;
  is_active: boolean;
  created_at: string;
}

export interface SystemConfig {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

// API Request/Response Types
export interface CreateComplaintRequest {
  description: string;
  voice_transcript?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  location_landmark?: string;
}

export interface UpdateComplaintStatusRequest {
  status: ComplaintStatus;
  notes?: string;
  resolution_type?: string;
}

export interface ApproveComplaintRequest {
  approved: boolean;
  notes?: string;
  department_id?: string;
  urgency?: UrgencyLevel;
}

export interface AssignComplaintRequest {
  assigned_to?: string;
}

export interface CitizenFeedbackRequest {
  rating: number;
  feedback_text?: string;
}

// AI Classification Types
export interface AIClassificationResult {
  department: string;
  department_code: string;
  urgency: UrgencyLevel;
  confidence: number;
  reasoning: string;
  keywords: string[];
  suggested_priority: number;
}

export interface AIClassificationRequest {
  complaint_id: string;
  description: string;
  location_address?: string;
  image_analysis?: string;
}

// Webhook Types
export interface N8NWebhookPayload {
  event_type: string;
  complaint_id: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// Analytics Types
export interface DashboardStats {
  complaints_today: number;
  complaints_this_week: number;
  pending_review: number;
  in_progress: number;
  sla_breached: number;
  auto_approved_total: number;
  manually_reviewed_total: number;
  avg_resolution_hours: number | null;
  sla_compliance_rate: number | null;
}

export interface DepartmentStats {
  department_id: string;
  department_name: string;
  total_complaints: number;
  open_complaints: number;
  breached_complaints: number;
  avg_resolution_hours: number | null;
}

export interface AIPerformanceStats {
  date: string;
  total_classified: number;
  avg_confidence: number;
  auto_approved: number;
  manual_review: number;
  auto_approval_rate: number;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Filter Types
export interface ComplaintFilters {
  status?: ComplaintStatus[] | ComplaintStatus;
  department_id?: string;
  urgency?: UrgencyLevel[];
  date_from?: string;
  date_to?: string;
  sla_breached?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Auth Types
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  department_id: string | null;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
