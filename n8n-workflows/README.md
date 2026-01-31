# n8n Workflows Setup Guide

This directory contains the n8n workflow configurations for the Digital Complaint Management System. These workflows handle complaint routing, SLA monitoring, notifications, and analytics.

## Workflows Overview

### 1. Complaint Routing (`complaint-routing.json`)
- **Trigger**: Webhook (POST `/webhook/complaint-routing`)
- **Purpose**: Routes new complaints based on AI classification confidence
- **Flow**:
  1. Receives new complaint data from backend
  2. Checks if complaint is in critical area
  3. Sends critical alerts if needed
  4. Auto-approves high-confidence (≥75%) classifications
  5. Flags low-confidence for manual review
  6. Notifies assigned department

### 2. SLA Monitoring (`sla-monitoring.json`)
- **Trigger**: Schedule (every 15 minutes)
- **Purpose**: Monitors SLA compliance and triggers escalations
- **Flow**:
  1. Calls backend to check for SLA breaches
  2. Creates escalations for newly breached complaints
  3. Upgrades escalation level for existing breaches
  4. Sends notifications to appropriate stakeholders

### 3. Status Change Notifications (`status-notifications.json`)
- **Trigger**: Webhook (POST `/webhook/status-change`)
- **Purpose**: Sends multi-channel notifications on status changes
- **Flow**:
  1. Receives status change event
  2. Determines notification recipients and channels
  3. Sends in-app, email, and/or SMS notifications
  4. Logs analytics event

### 4. Daily Analytics Report (`daily-report.json`)
- **Trigger**: Schedule (daily at 8 AM)
- **Purpose**: Generates and sends daily performance reports
- **Flow**:
  1. Fetches dashboard and department statistics
  2. Generates HTML report with metrics
  3. Emails report to administrators
  4. Sends critical alerts if SLA breaches exceed threshold

## Setup Instructions

### Prerequisites
- n8n Cloud account or self-hosted n8n instance
- Backend API running and accessible
- HTTP Header Auth credentials configured

### Step 1: Configure Credentials

In n8n, create the following credential:

**HTTP Header Auth - System API Key**
```
Name: System API Key
Header Name: x-api-key
Header Value: <your-system-api-key>
```

### Step 2: Set Environment Variables

In n8n settings, configure these environment variables:

```
BACKEND_URL=https://your-api-domain.com
```

### Step 3: Import Workflows

1. Go to n8n dashboard
2. Click "Import from file"
3. Import each JSON file from this directory
4. Activate each workflow

### Step 4: Update Webhook URLs

After importing, copy the webhook URLs from n8n and update your backend `.env`:

```env
N8N_COMPLAINT_ROUTING_WEBHOOK=https://your-n8n-instance/webhook/xxx
N8N_STATUS_CHANGE_WEBHOOK=https://your-n8n-instance/webhook/xxx
N8N_SLA_CHECK_WEBHOOK=https://your-n8n-instance/webhook/xxx
```

## Workflow Details

### Complaint Routing Logic

```
New Complaint
    │
    ├── Is Critical Area?
    │   ├── YES → Send Critical Alert → Continue
    │   └── NO → Continue
    │
    └── AI Confidence ≥ 75%?
        ├── YES → Auto Approve → Assign Department → Notify
        └── NO → Flag for Review → Notify Admin
```

### SLA Escalation Levels

| Level | Triggered After | Notified |
|-------|-----------------|----------|
| Level 1 | SLA Breach | Department Head |
| Level 2 | 24 hours after L1 | Division Manager |
| Level 3 | 48 hours after L1 | Director |
| Executive | 72 hours after L1 | City Administrator |

### Notification Channels by Status

| Status | In-App | Email | SMS |
|--------|--------|-------|-----|
| Approved | ✅ | ✅ | ❌ |
| Assigned | ✅ | ✅ | ❌ |
| In Progress | ✅ | ❌ | ❌ |
| Resolved | ✅ | ✅ | ✅ |
| Rejected | ✅ | ✅ | ❌ |
| Escalated | ✅ | ✅ | ✅ |

## Testing Workflows

### Test Complaint Routing
```bash
curl -X POST https://your-n8n-instance/webhook/complaint-routing \
  -H "Content-Type: application/json" \
  -d '{
    "event": "complaint.created",
    "payload": {
      "complaint_id": "test-123",
      "is_critical": false,
      "ai_confidence": 0.85,
      "department_id": "dept-001"
    }
  }'
```

### Test Status Notification
```bash
curl -X POST https://your-n8n-instance/webhook/status-change \
  -H "Content-Type: application/json" \
  -d '{
    "event": "complaint.status_changed",
    "payload": {
      "complaint_id": "test-123",
      "user_id": "user-001",
      "old_status": "in_progress",
      "new_status": "resolved"
    }
  }'
```

## Monitoring

### Execution History
- Access n8n dashboard → Executions
- Filter by workflow name
- Review failed executions

### Common Issues

1. **Webhook Not Responding**
   - Check n8n is running
   - Verify webhook URL is correct
   - Check CORS settings

2. **Authentication Failures**
   - Verify API key is correct
   - Check credential is attached to nodes

3. **SLA Check Not Running**
   - Verify schedule trigger is active
   - Check timezone settings

## Production Checklist

- [ ] All credentials configured
- [ ] Environment variables set
- [ ] Workflows imported and activated
- [ ] Webhook URLs updated in backend
- [ ] Test each workflow manually
- [ ] Monitor first few executions
- [ ] Set up error notifications
