// Type definitions for the frontend

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

// Alias types for backward compatibility
export type Urgency = UrgencyLevel;
export type Category = 
  | 'infrastructure'
  | 'sanitation'
  | 'utilities'
  | 'public_safety'
  | 'transportation'
  | 'environment'
  | 'healthcare'
  | 'education'
  | 'other';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  department?: Department;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  sla_hours: number;
  is_active: boolean;
}

export interface Complaint {
  id: string;
  user_id: string;
  title?: string;
  description: string;
  voice_transcript: string | null;
  image_urls: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  location_landmark: string | null;
  location?: string;
  category?: Category;
  department_id: string | null;
  urgency: UrgencyLevel;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_sentiment?: string;
  is_auto_approved: boolean;
  is_spam_flagged?: boolean;
  is_critical?: boolean;
  status: ComplaintStatus;
  priority_score: number;
  is_critical_area: boolean;
  resolution_notes: string | null;
  citizen_feedback?: string;
  citizen_feedback_rating: number | null;
  citizen_satisfaction?: number;
  sla_deadline: string | null;
  sla_breached: boolean;
  assigned_to?: string;
  created_at: string;
  resolved_at: string | null;
  department?: Department;
  citizen?: Pick<User, 'id' | 'full_name' | 'email'>;
  assigned_user?: Pick<User, 'id' | 'full_name' | 'email'>;
  status_logs?: StatusLog[];
}

export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  complaints_today: number;
  complaints_this_week: number;
  total_complaints: number;
  pending_review: number;
  in_progress: number;
  resolved: number;
  sla_breached: number;
  sla_at_risk: number;
  resolution_rate: number;
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

export interface StatusLog {
  id: string;
  complaint_id: string;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  created_at: string;
  changed_by_user?: { full_name: string };
}

export interface Escalation {
  id: string;
  complaint_id: string;
  escalation_level: string;
  reason: string;
  is_system_escalation: boolean;
  acknowledged: boolean;
  created_at: string;
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

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Form Types
export interface CreateComplaintForm {
  description: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  location_landmark?: string;
  images?: FileList;
}

export interface ReviewComplaintForm {
  approved: boolean;
  notes?: string;
  department_id?: string;
  urgency?: UrgencyLevel;
}

export interface UpdateStatusForm {
  status: ComplaintStatus;
  notes?: string;
  resolution_type?: string;
}

export interface FeedbackForm {
  rating: number;
  feedback_text?: string;
}
// SLA types
export interface SLAComplaint extends Complaint {
  hours_remaining: number;
  sla_status: 'breached' | 'at-risk' | 'on-track';
  escalation_level?: number;
}

// Trend data for analytics
export interface TrendData {
  date: string;
  count: number;
}

// Alias for backward compatibility
export type ComplaintStatusLog = StatusLog;