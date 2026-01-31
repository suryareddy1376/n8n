-- =====================================================
-- DIGITAL COMPLAINT MANAGEMENT SYSTEM (DCMS)
-- PostgreSQL Schema for Supabase
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('citizen', 'department', 'admin');

-- Complaint status lifecycle
CREATE TYPE complaint_status AS ENUM (
    'submitted',           -- Initial submission
    'pending_review',      -- Low confidence, needs manual review
    'approved',            -- Approved for routing
    'rejected',            -- Rejected by admin
    'assigned',            -- Assigned to department
    'in_progress',         -- Being worked on
    'resolved',            -- Resolution provided
    'closed',              -- Citizen confirmed or auto-closed
    'escalated'            -- SLA breached, escalated
);

-- Urgency levels
CREATE TYPE urgency_level AS ENUM ('normal', 'high', 'critical');

-- Escalation levels
CREATE TYPE escalation_level AS ENUM ('level_1', 'level_2', 'level_3', 'executive');

-- Notification channels
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'whatsapp', 'push');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE, -- Short code for AI classification
    description TEXT,
    sla_hours INTEGER NOT NULL DEFAULT 72, -- Default SLA in hours
    escalation_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for department lookups
CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_departments_active ON departments(is_active) WHERE is_active = TRUE;

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'citizen',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_department_role CHECK (
        (role = 'department' AND department_id IS NOT NULL) OR
        (role != 'department')
    )
);

-- Indexes for users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);

-- Critical areas/zones for priority scoring
CREATE TABLE critical_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lat_min DECIMAL(10, 8) NOT NULL,
    lat_max DECIMAL(10, 8) NOT NULL,
    lng_min DECIMAL(11, 8) NOT NULL,
    lng_max DECIMAL(11, 8) NOT NULL,
    priority_multiplier DECIMAL(3, 2) DEFAULT 1.5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaints table - Main entity
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Submission details
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    voice_transcript TEXT, -- If submitted via voice
    image_urls TEXT[], -- Array of image URLs from Supabase Storage
    
    -- Location data
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_address TEXT, -- Reverse geocoded address
    location_landmark TEXT, -- Manual landmark input
    
    -- AI Classification results
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    urgency urgency_level DEFAULT 'normal',
    ai_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    ai_reasoning TEXT, -- AI explanation for classification
    ai_classified_at TIMESTAMPTZ,
    ai_model_version VARCHAR(50), -- Track which model version was used
    
    -- Manual review fields
    is_auto_approved BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,
    
    -- Status tracking
    status complaint_status DEFAULT 'submitted',
    
    -- Priority scoring
    priority_score DECIMAL(10, 2) DEFAULT 0,
    is_critical_area BOOLEAN DEFAULT FALSE,
    
    -- Resolution
    resolution_notes TEXT,
    resolution_type VARCHAR(50), -- 'fixed', 'duplicate', 'invalid', 'referred'
    citizen_feedback_rating INTEGER CHECK (citizen_feedback_rating BETWEEN 1 AND 5),
    citizen_feedback_text TEXT,
    
    -- SLA tracking
    sla_deadline TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,
    sla_breach_notified BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comprehensive indexes for complaints
CREATE INDEX idx_complaints_user ON complaints(user_id);
CREATE INDEX idx_complaints_department ON complaints(department_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_urgency ON complaints(urgency);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX idx_complaints_sla_deadline ON complaints(sla_deadline) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_complaints_pending_review ON complaints(created_at) WHERE status = 'pending_review';
CREATE INDEX idx_complaints_priority ON complaints(priority_score DESC) WHERE status IN ('approved', 'assigned');
CREATE INDEX idx_complaints_assigned_to ON complaints(assigned_to) WHERE assigned_to IS NOT NULL;

-- Full text search on description
CREATE INDEX idx_complaints_description_search ON complaints USING gin(to_tsvector('english', description));

-- Complaint status change log - Audit trail
CREATE TABLE complaint_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    old_status complaint_status,
    new_status complaint_status NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    metadata JSONB, -- Additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status log queries
CREATE INDEX idx_status_logs_complaint ON complaint_status_logs(complaint_id);
CREATE INDEX idx_status_logs_created ON complaint_status_logs(created_at DESC);

-- Escalations table
CREATE TABLE escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    escalation_level escalation_level NOT NULL,
    previous_level escalation_level,
    reason TEXT NOT NULL,
    escalated_to UUID REFERENCES users(id) ON DELETE SET NULL,
    escalated_by UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if system-triggered
    is_system_escalation BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for escalations
CREATE INDEX idx_escalations_complaint ON escalations(complaint_id);
CREATE INDEX idx_escalations_level ON escalations(escalation_level);
CREATE INDEX idx_escalations_unacknowledged ON escalations(created_at) WHERE acknowledged = FALSE;

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel notification_channel NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    send_status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_pending ON notifications(created_at) WHERE send_status = 'pending';

-- Attachments table (for additional file management)
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL, -- in bytes
    storage_path TEXT NOT NULL, -- Supabase storage path
    public_url TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_complaint ON attachments(complaint_id);

-- System configuration table
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs for n8n integration
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_type ON webhook_logs(webhook_type);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- Analytics events table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate priority score
CREATE OR REPLACE FUNCTION calculate_priority_score(
    p_urgency urgency_level,
    p_created_at TIMESTAMPTZ,
    p_is_critical_area BOOLEAN
) RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_urgency_weight DECIMAL := 40;
    v_time_weight DECIMAL := 35;
    v_location_weight DECIMAL := 25;
    v_urgency_value DECIMAL;
    v_hours_open DECIMAL;
    v_time_value DECIMAL;
    v_location_value DECIMAL;
BEGIN
    -- Urgency value
    CASE p_urgency
        WHEN 'critical' THEN v_urgency_value := 1.0;
        WHEN 'high' THEN v_urgency_value := 0.7;
        ELSE v_urgency_value := 0.3;
    END CASE;
    
    -- Time value (normalized, max at 168 hours = 1 week)
    v_hours_open := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
    v_time_value := LEAST(v_hours_open / 168, 1.0);
    
    -- Location value
    v_location_value := CASE WHEN p_is_critical_area THEN 1.0 ELSE 0.0 END;
    
    RETURN (v_urgency_weight * v_urgency_value) +
           (v_time_weight * v_time_value) +
           (v_location_weight * v_location_value);
END;
$$ LANGUAGE plpgsql;

-- Function to check if location is in critical area
CREATE OR REPLACE FUNCTION is_in_critical_area(
    p_lat DECIMAL(10, 8),
    p_lng DECIMAL(11, 8)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM critical_areas
        WHERE is_active = TRUE
        AND p_lat BETWEEN lat_min AND lat_max
        AND p_lng BETWEEN lng_min AND lng_max
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate SLA deadline
CREATE OR REPLACE FUNCTION calculate_sla_deadline(
    p_department_id UUID,
    p_urgency urgency_level,
    p_created_at TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_sla_hours INTEGER;
    v_urgency_multiplier DECIMAL;
BEGIN
    -- Get base SLA from department
    SELECT sla_hours INTO v_sla_hours
    FROM departments
    WHERE id = p_department_id;
    
    IF v_sla_hours IS NULL THEN
        v_sla_hours := 72; -- Default
    END IF;
    
    -- Apply urgency multiplier
    CASE p_urgency
        WHEN 'critical' THEN v_urgency_multiplier := 0.25; -- 25% of normal time
        WHEN 'high' THEN v_urgency_multiplier := 0.5;      -- 50% of normal time
        ELSE v_urgency_multiplier := 1.0;
    END CASE;
    
    RETURN p_created_at + (v_sla_hours * v_urgency_multiplier || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO complaint_status_logs (
            complaint_id,
            old_status,
            new_status,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            jsonb_build_object(
                'timestamp', NOW(),
                'priority_score', NEW.priority_score
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log status changes
CREATE TRIGGER log_complaint_status_change
    AFTER UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION log_status_change();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Dashboard statistics view
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS complaints_today,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS complaints_this_week,
    COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_review,
    COUNT(*) FILTER (WHERE status IN ('assigned', 'in_progress')) AS in_progress,
    COUNT(*) FILTER (WHERE sla_breached = TRUE AND status NOT IN ('resolved', 'closed')) AS sla_breached,
    COUNT(*) FILTER (WHERE is_auto_approved = TRUE) AS auto_approved_total,
    COUNT(*) FILTER (WHERE is_auto_approved = FALSE AND reviewed_at IS NOT NULL) AS manually_reviewed_total,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) 
        FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
    (COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND sla_breached = FALSE)::DECIMAL / 
        NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0) * 100) AS sla_compliance_rate
FROM complaints;

-- Complaints by department view
CREATE OR REPLACE VIEW v_complaints_by_department AS
SELECT
    d.id AS department_id,
    d.name AS department_name,
    COUNT(c.id) AS total_complaints,
    COUNT(c.id) FILTER (WHERE c.status NOT IN ('resolved', 'closed')) AS open_complaints,
    COUNT(c.id) FILTER (WHERE c.sla_breached = TRUE) AS breached_complaints,
    AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600) 
        FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_hours
FROM departments d
LEFT JOIN complaints c ON c.department_id = d.id
GROUP BY d.id, d.name;

-- SLA breach report view
CREATE OR REPLACE VIEW v_sla_breach_report AS
SELECT
    c.id AS complaint_id,
    c.description,
    c.urgency,
    c.status,
    c.created_at,
    c.sla_deadline,
    NOW() - c.sla_deadline AS overdue_by,
    d.name AS department_name,
    u.full_name AS citizen_name,
    au.full_name AS assigned_to_name
FROM complaints c
LEFT JOIN departments d ON c.department_id = d.id
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN users au ON c.assigned_to = au.id
WHERE c.sla_breached = TRUE
AND c.status NOT IN ('resolved', 'closed')
ORDER BY c.sla_deadline ASC;

-- AI performance metrics view
CREATE OR REPLACE VIEW v_ai_performance AS
SELECT
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS total_classified,
    AVG(ai_confidence) AS avg_confidence,
    COUNT(*) FILTER (WHERE is_auto_approved = TRUE) AS auto_approved,
    COUNT(*) FILTER (WHERE is_auto_approved = FALSE) AS manual_review,
    (COUNT(*) FILTER (WHERE is_auto_approved = TRUE)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100) AS auto_approval_rate
FROM complaints
WHERE ai_classified_at IS NOT NULL
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
