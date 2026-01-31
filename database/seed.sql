-- =====================================================
-- SEED DATA
-- Digital Complaint Management System
-- =====================================================

-- Insert departments
INSERT INTO departments (id, name, code, description, sla_hours, escalation_email) VALUES
    ('d1000000-0000-0000-0000-000000000001', 'Water Supply', 'WATER', 'Water supply, leakage, contamination issues', 48, 'water-escalation@gov.local'),
    ('d1000000-0000-0000-0000-000000000002', 'Electricity', 'ELECTRICITY', 'Power outages, electrical hazards, street lights', 24, 'electricity-escalation@gov.local'),
    ('d1000000-0000-0000-0000-000000000003', 'Sanitation', 'SANITATION', 'Garbage collection, sewage, public cleanliness', 72, 'sanitation-escalation@gov.local'),
    ('d1000000-0000-0000-0000-000000000004', 'Public Safety', 'SAFETY', 'Road hazards, public safety concerns, accidents', 12, 'safety-escalation@gov.local'),
    ('d1000000-0000-0000-0000-000000000005', 'Roads & Infrastructure', 'ROADS', 'Potholes, road damage, traffic signals', 96, 'roads-escalation@gov.local'),
    ('d1000000-0000-0000-0000-000000000006', 'Other', 'OTHER', 'General complaints not fitting other categories', 120, 'general-escalation@gov.local');

-- Insert critical areas (example coordinates for a city)
INSERT INTO critical_areas (name, description, lat_min, lat_max, lng_min, lng_max, priority_multiplier) VALUES
    ('Government Complex', 'Central government office area', 12.9700, 12.9800, 77.5900, 77.6000, 1.5),
    ('Main Hospital Zone', 'Area around city main hospital', 12.9600, 12.9650, 77.5700, 77.5750, 2.0),
    ('Central Bus Station', 'Main public transport hub', 12.9750, 12.9800, 77.5800, 77.5850, 1.8),
    ('School District', 'Area with multiple schools', 12.9500, 12.9550, 77.6000, 77.6100, 1.7),
    ('Industrial Area', 'Industrial zone with factories', 12.9400, 12.9500, 77.6200, 77.6400, 1.3);

-- Insert system configuration
INSERT INTO system_config (key, value, description) VALUES
    ('ai_confidence_threshold', '{"value": 0.75}', 'Minimum confidence score for auto-approval'),
    ('sla_warning_threshold_hours', '{"value": 6}', 'Hours before SLA deadline to send warning'),
    ('max_escalation_level', '{"value": 3}', 'Maximum escalation levels before executive review'),
    ('priority_weights', '{"urgency": 40, "time": 35, "location": 25}', 'Weights for priority score calculation'),
    ('notification_channels', '{"email": true, "sms": false, "whatsapp": false, "push": true}', 'Enabled notification channels'),
    ('working_hours', '{"start": 9, "end": 18, "timezone": "Asia/Kolkata"}', 'Working hours for SLA calculation'),
    ('rate_limit', '{"requests_per_minute": 100, "requests_per_hour": 1000}', 'API rate limiting configuration'),
    ('ai_model', '{"provider": "gemini", "model": "gemini-pro", "version": "1.0"}', 'AI model configuration');

-- Note: Users should be created through Supabase Auth
-- The following is an example of how user records would look:

/*
-- Example admin user (create via Supabase Auth first)
INSERT INTO users (id, email, full_name, role) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'admin@dcms.gov.local', 'System Administrator', 'admin');

-- Example department users
INSERT INTO users (id, email, full_name, role, department_id) VALUES
    ('a2000000-0000-0000-0000-000000000001', 'water.officer@dcms.gov.local', 'Water Department Officer', 'department', 'd1000000-0000-0000-0000-000000000001'),
    ('a2000000-0000-0000-0000-000000000002', 'electricity.officer@dcms.gov.local', 'Electricity Department Officer', 'department', 'd1000000-0000-0000-0000-000000000002');

-- Example citizen users
INSERT INTO users (id, email, full_name, role) VALUES
    ('a3000000-0000-0000-0000-000000000001', 'citizen1@example.com', 'John Citizen', 'citizen'),
    ('a3000000-0000-0000-0000-000000000002', 'citizen2@example.com', 'Jane Citizen', 'citizen');
*/

-- Create function to auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'citizen')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
