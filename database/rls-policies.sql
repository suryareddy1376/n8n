-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Digital Complaint Management System
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's department
CREATE OR REPLACE FUNCTION public.get_user_department()
RETURNS UUID AS $$
    SELECT department_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is department user
CREATE OR REPLACE FUNCTION public.is_department_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'department'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

-- Admins can view all users
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    USING (public.is_admin());

-- Department users can view users in their department
CREATE POLICY "Department users can view department members"
    ON users FOR SELECT
    USING (
        public.is_department_user() AND
        department_id = public.get_user_department()
    );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND
        role = (SELECT role FROM users WHERE id = auth.uid()) -- Cannot change own role
    );

-- Admins can update any user
CREATE POLICY "Admins can update users"
    ON users FOR UPDATE
    USING (public.is_admin());

-- Only system can insert users (via trigger from auth.users)
CREATE POLICY "System insert users"
    ON users FOR INSERT
    WITH CHECK (id = auth.uid());

-- =====================================================
-- DEPARTMENTS TABLE POLICIES
-- =====================================================

-- Anyone authenticated can view departments
CREATE POLICY "Authenticated users can view departments"
    ON departments FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can modify departments
CREATE POLICY "Admins can insert departments"
    ON departments FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update departments"
    ON departments FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete departments"
    ON departments FOR DELETE
    USING (public.is_admin());

-- =====================================================
-- COMPLAINTS TABLE POLICIES
-- =====================================================

-- Citizens can view only their own complaints
CREATE POLICY "Citizens can view own complaints"
    ON complaints FOR SELECT
    USING (
        public.get_user_role() = 'citizen' AND
        user_id = auth.uid()
    );

-- Department users can view complaints assigned to their department
CREATE POLICY "Department users can view department complaints"
    ON complaints FOR SELECT
    USING (
        public.is_department_user() AND
        department_id = public.get_user_department()
    );

-- Admins can view all complaints
CREATE POLICY "Admins can view all complaints"
    ON complaints FOR SELECT
    USING (public.is_admin());

-- Citizens can create complaints
CREATE POLICY "Citizens can create complaints"
    ON complaints FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'citizen' AND
        user_id = auth.uid() AND
        status = 'submitted' -- Must start as submitted
    );

-- Citizens can update their own complaints (limited fields - feedback only)
CREATE POLICY "Citizens can add feedback to own complaints"
    ON complaints FOR UPDATE
    USING (
        public.get_user_role() = 'citizen' AND
        user_id = auth.uid() AND
        status IN ('resolved', 'closed')
    )
    WITH CHECK (
        user_id = auth.uid()
    );

-- Department users can update assigned complaints
CREATE POLICY "Department users can update department complaints"
    ON complaints FOR UPDATE
    USING (
        public.is_department_user() AND
        department_id = public.get_user_department()
    );

-- Admins can update any complaint
CREATE POLICY "Admins can update any complaint"
    ON complaints FOR UPDATE
    USING (public.is_admin());

-- =====================================================
-- COMPLAINT STATUS LOGS POLICIES
-- =====================================================

-- Citizens can view logs for their complaints
CREATE POLICY "Citizens can view own complaint logs"
    ON complaint_status_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = complaint_status_logs.complaint_id
            AND complaints.user_id = auth.uid()
        )
    );

-- Department users can view logs for department complaints
CREATE POLICY "Department users can view department complaint logs"
    ON complaint_status_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = complaint_status_logs.complaint_id
            AND complaints.department_id = public.get_user_department()
        )
    );

-- Admins can view all logs
CREATE POLICY "Admins can view all complaint logs"
    ON complaint_status_logs FOR SELECT
    USING (public.is_admin());

-- Insert is handled by trigger, allow service role
CREATE POLICY "System can insert status logs"
    ON complaint_status_logs FOR INSERT
    WITH CHECK (TRUE);

-- =====================================================
-- ESCALATIONS TABLE POLICIES
-- =====================================================

-- Same visibility as complaints
CREATE POLICY "Users can view escalations for visible complaints"
    ON escalations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = escalations.complaint_id
            AND (
                (public.get_user_role() = 'citizen' AND complaints.user_id = auth.uid()) OR
                (public.is_department_user() AND complaints.department_id = public.get_user_department()) OR
                public.is_admin()
            )
        )
    );

-- Only admins and system can create escalations
CREATE POLICY "Admins can create escalations"
    ON escalations FOR INSERT
    WITH CHECK (public.is_admin() OR is_system_escalation = TRUE);

-- Admins can update escalations (acknowledge)
CREATE POLICY "Admins can update escalations"
    ON escalations FOR UPDATE
    USING (public.is_admin());

-- =====================================================
-- NOTIFICATIONS TABLE POLICIES
-- =====================================================

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (TRUE);

-- =====================================================
-- ATTACHMENTS TABLE POLICIES
-- =====================================================

-- Same visibility as parent complaint
CREATE POLICY "Users can view attachments for visible complaints"
    ON attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = attachments.complaint_id
            AND (
                (public.get_user_role() = 'citizen' AND complaints.user_id = auth.uid()) OR
                (public.is_department_user() AND complaints.department_id = public.get_user_department()) OR
                public.is_admin()
            )
        )
    );

-- Citizens can add attachments to their own complaints
CREATE POLICY "Citizens can add attachments to own complaints"
    ON attachments FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = attachments.complaint_id
            AND complaints.user_id = auth.uid()
        )
    );

-- Department users can add attachments to department complaints
CREATE POLICY "Department users can add attachments"
    ON attachments FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM complaints
            WHERE complaints.id = attachments.complaint_id
            AND complaints.department_id = public.get_user_department()
        )
    );

-- =====================================================
-- CRITICAL AREAS TABLE POLICIES
-- =====================================================

-- Anyone authenticated can view critical areas
CREATE POLICY "Authenticated users can view critical areas"
    ON critical_areas FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can modify critical areas
CREATE POLICY "Admins can manage critical areas"
    ON critical_areas FOR ALL
    USING (public.is_admin());

-- =====================================================
-- SYSTEM CONFIG TABLE POLICIES
-- =====================================================

-- Authenticated users can read config
CREATE POLICY "Authenticated users can view config"
    ON system_config FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can modify config
CREATE POLICY "Admins can manage config"
    ON system_config FOR ALL
    USING (public.is_admin());

-- =====================================================
-- WEBHOOK LOGS TABLE POLICIES
-- =====================================================

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
    ON webhook_logs FOR SELECT
    USING (public.is_admin());

-- System can insert webhook logs
CREATE POLICY "System can insert webhook logs"
    ON webhook_logs FOR INSERT
    WITH CHECK (TRUE);

-- =====================================================
-- ANALYTICS EVENTS TABLE POLICIES
-- =====================================================

-- Only admins can view analytics
CREATE POLICY "Admins can view analytics"
    ON analytics_events FOR SELECT
    USING (public.is_admin());

-- System can insert analytics events
CREATE POLICY "System can insert analytics events"
    ON analytics_events FOR INSERT
    WITH CHECK (TRUE);

-- =====================================================
-- SERVICE ROLE BYPASS
-- =====================================================

-- Note: The service role (used by backend) bypasses RLS by default
-- This is configured in Supabase and allows the backend to perform
-- all operations regardless of RLS policies

-- =====================================================
-- GRANTS FOR AUTHENTICATED USERS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
