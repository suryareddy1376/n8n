# Failure Scenarios and Recovery Guide

This document outlines potential failure scenarios in the Digital Complaint Management System and their recovery procedures.

## Table of Contents
1. [Database Failures](#database-failures)
2. [AI Classification Failures](#ai-classification-failures)
3. [Workflow Failures](#workflow-failures)
4. [Authentication Failures](#authentication-failures)
5. [SLA Monitoring Failures](#sla-monitoring-failures)
6. [Network Failures](#network-failures)
7. [Data Consistency Issues](#data-consistency-issues)

---

## Database Failures

### Scenario 1: Supabase Connection Timeout

**Symptoms:**
- API returns 500 errors
- Logs show "ECONNREFUSED" or "ETIMEDOUT"

**Impact:**
- All database operations fail
- Users cannot submit or view complaints

**Detection:**
```javascript
// Health check endpoint monitors this
if (!supabaseClient.auth.getSession()) {
  throw new Error('Database connection failed');
}
```

**Recovery:**
1. Check Supabase status at status.supabase.com
2. Verify network connectivity
3. Check environment variables
4. Restart backend services

**Prevention:**
- Connection pooling with retry logic
- Circuit breaker pattern implemented
- Fallback to read replica if available

### Scenario 2: Database Schema Migration Failure

**Symptoms:**
- Application errors on specific operations
- "Column not found" or "Relation does not exist"

**Recovery:**
1. Rollback to previous schema version
2. Verify migration scripts
3. Apply migrations in order
4. Test in staging first

---

## AI Classification Failures

### Scenario 3: Gemini API Rate Limit Exceeded

**Symptoms:**
- Classification returns null/undefined
- 429 errors in logs
- Complaints stuck in unclassified state

**Impact:**
- New complaints not automatically classified
- Increased manual review queue

**Detection:**
```typescript
// Service checks for rate limit errors
if (error.status === 429) {
  logger.warn('Gemini API rate limited');
  return { category: null, urgency: null, confidence: 0 };
}
```

**Recovery:**
1. Automatic retry with exponential backoff (implemented)
2. Queue complaints for later classification
3. Manual classification for urgent items

**Fallback Flow:**
```
Complaint Submitted
    │
    ├── Try AI Classification
    │   ├── Success → Continue with classification
    │   └── Failure → Set status to pending_review
    │                 Mark as needs_manual_classification
    │                 Add to priority queue
    │
    └── Notify admin of AI failure
```

### Scenario 4: Gemini API Returns Invalid JSON

**Symptoms:**
- JSON parse errors in logs
- Classification confidence is 0

**Detection:**
```typescript
try {
  const result = JSON.parse(aiResponse);
  if (!result.category || !result.urgency || !result.confidence) {
    throw new Error('Invalid classification response');
  }
} catch (e) {
  logger.error('AI classification parse error', { response: aiResponse });
}
```

**Recovery:**
1. Log raw response for debugging
2. Retry with simplified prompt
3. Fall back to keyword-based classification
4. Mark for manual review

### Scenario 5: AI Misclassification

**Symptoms:**
- Complaints routed to wrong department
- Low citizen satisfaction scores

**Detection:**
- Department rejects complaint
- Admin reclassifies manually
- Analytics show high reclassification rate

**Recovery:**
1. Admin uses reclassification endpoint
2. Complaint re-routed to correct department
3. AI feedback logged for model improvement

**Prevention:**
- Confidence threshold (75%) for auto-approval
- Low-confidence complaints require manual review
- Regular analysis of misclassification patterns

---

## Workflow Failures

### Scenario 6: n8n Webhook Unreachable

**Symptoms:**
- Webhook calls fail with connection errors
- Complaints not routed after approval
- Notifications not sent

**Impact:**
- Delayed complaint processing
- Missing notifications
- SLA monitoring gaps

**Detection:**
```typescript
// Webhook service logs failures
try {
  await axios.post(webhookUrl, payload, { timeout: 5000 });
} catch (error) {
  logger.error('Webhook failed', { 
    url: webhookUrl, 
    error: error.message 
  });
  // Store for retry
  await storeFailedWebhook(webhookUrl, payload);
}
```

**Recovery:**
1. Automatic retry queue (3 attempts with backoff)
2. Manual trigger from admin panel
3. Check n8n status and restart if needed

**Retry Logic:**
```
Attempt 1: Immediate
Attempt 2: After 1 minute
Attempt 3: After 5 minutes
After 3 failures: Alert admin, store for manual retry
```

### Scenario 7: n8n Workflow Error

**Symptoms:**
- Webhook returns 500 error
- Partial workflow execution
- Inconsistent state

**Recovery:**
1. Check n8n execution logs
2. Identify failed node
3. Manually complete remaining steps
4. Fix workflow and redeploy

---

## Authentication Failures

### Scenario 8: JWT Token Expired Mid-Session

**Symptoms:**
- Sudden 401 errors
- User redirected to login

**Impact:**
- Form data may be lost
- Poor user experience

**Prevention:**
```typescript
// Frontend interceptor refreshes token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newSession = await supabase.auth.refreshSession();
      if (newSession.data.session) {
        // Retry original request with new token
        error.config.headers.Authorization = `Bearer ${newSession.data.session.access_token}`;
        return apiClient(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

### Scenario 9: Supabase Auth Service Down

**Symptoms:**
- Login/signup fails
- Token refresh fails
- All authenticated requests fail

**Recovery:**
1. Check Supabase status
2. Cache valid sessions temporarily
3. Graceful degradation: show read-only data
4. Display maintenance message

---

## SLA Monitoring Failures

### Scenario 10: SLA Check Cron Not Running

**Symptoms:**
- Breached complaints not escalated
- No SLA breach notifications
- Escalation table not updated

**Detection:**
```sql
-- Check for missing SLA checks
SELECT MAX(created_at) as last_sla_check
FROM webhook_logs
WHERE event_type = 'sla_check';

-- Alert if > 30 minutes ago
```

**Impact:**
- SLA breaches go unnoticed
- Escalations delayed
- Potential citizen dissatisfaction

**Recovery:**
1. Check n8n schedule trigger
2. Manually trigger SLA check
3. Verify cron expression
4. Set up secondary monitoring

**Fallback:**
- Backend cron job as backup
- Database trigger for time-based checks
- Alert if no SLA check in 30 minutes

### Scenario 11: False SLA Breach Calculation

**Symptoms:**
- Complaints marked breached incorrectly
- SLA times don't account for business hours

**Detection:**
- Manual audit of breached complaints
- Citizen disputes

**Prevention:**
```typescript
// SLA calculation considers business hours
function calculateSLADeadline(urgency: Urgency, createdAt: Date): Date {
  const slaHours = SLA_HOURS[urgency];
  let deadline = new Date(createdAt);
  let hoursAdded = 0;
  
  while (hoursAdded < slaHours) {
    deadline.setHours(deadline.getHours() + 1);
    if (isBusinessHour(deadline)) {
      hoursAdded++;
    }
  }
  
  return deadline;
}
```

---

## Network Failures

### Scenario 12: Partial Response / Connection Drop

**Symptoms:**
- Frontend shows loading indefinitely
- Incomplete data displayed
- Console shows network errors

**Recovery:**
```typescript
// Frontend implements timeout and retry
const fetchWithRetry = async (url: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
};
```

### Scenario 13: CDN / Static Asset Failure

**Symptoms:**
- Page partially loads
- Styles missing
- JavaScript errors

**Prevention:**
- Use fallback fonts
- Inline critical CSS
- Service worker for offline support

---

## Data Consistency Issues

### Scenario 14: Duplicate Complaint Submission

**Symptoms:**
- Same complaint appears multiple times
- User clicked submit multiple times

**Prevention:**
```typescript
// Frontend: Disable submit button
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);
  try {
    await submitComplaint(data);
  } finally {
    setIsSubmitting(false);
  }
};

// Backend: Idempotency key
app.post('/complaints', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (idempotencyKey) {
    const existing = await checkIdempotencyKey(idempotencyKey);
    if (existing) return res.json(existing);
  }
  // Process complaint...
});
```

### Scenario 15: Status Update Race Condition

**Symptoms:**
- Status jumps unexpectedly
- Invalid status transitions allowed

**Prevention:**
```sql
-- Use optimistic locking
UPDATE complaints
SET status = 'in_progress', updated_at = NOW(), version = version + 1
WHERE id = $1 AND status = 'assigned' AND version = $2;

-- Check affected rows - if 0, concurrent update occurred
```

```typescript
// Status transition validation
const VALID_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  pending_review: ['approved', 'rejected'],
  approved: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved', 'escalated'],
  resolved: ['closed', 'in_progress'], // Can reopen if citizen disputes
  escalated: ['in_progress', 'resolved'],
  closed: [], // Terminal state
  rejected: [], // Terminal state
};

function validateTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## Monitoring and Alerting

### Key Metrics to Monitor

| Metric | Threshold | Alert |
|--------|-----------|-------|
| API Response Time | > 2s | Warning |
| API Error Rate | > 5% | Critical |
| Database Connections | > 80% pool | Warning |
| AI Classification Failures | > 10% | Warning |
| Webhook Failures | > 3 consecutive | Critical |
| SLA Compliance | < 80% | Warning |
| Memory Usage | > 80% | Warning |

### Alert Configuration

```yaml
# alertmanager.yml example
groups:
  - name: complaint-system
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      - alert: AIServiceDown
        expr: ai_classification_failures_total > 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: AI classification service experiencing failures
```

---

## Recovery Runbooks

### Runbook 1: Complete System Recovery

```bash
#!/bin/bash
# Complete system recovery after major failure

echo "1. Checking database connectivity..."
curl -s https://$SUPABASE_URL/rest/v1/ -H "apikey: $SUPABASE_KEY" || exit 1

echo "2. Restarting backend services..."
pm2 restart complaint-api

echo "3. Restarting frontend..."
pm2 restart complaint-frontend

echo "4. Verifying health endpoints..."
sleep 10
curl -s http://localhost:4000/api/health || echo "API health check failed"
curl -s http://localhost:3000 || echo "Frontend health check failed"

echo "5. Triggering missed SLA checks..."
curl -X POST http://localhost:4000/api/webhooks/sla-check \
  -H "x-api-key: $SYSTEM_API_KEY"

echo "6. Processing webhook retry queue..."
curl -X POST http://localhost:4000/api/webhooks/retry-failed \
  -H "x-api-key: $SYSTEM_API_KEY"

echo "Recovery complete. Check logs for any remaining issues."
```

### Runbook 2: Data Reconciliation

```sql
-- Find complaints in inconsistent state
SELECT id, status, department_id, assigned_to, sla_deadline
FROM complaints
WHERE 
  (status = 'assigned' AND assigned_to IS NULL)
  OR (status = 'in_progress' AND department_id IS NULL)
  OR (status NOT IN ('closed', 'rejected') AND sla_deadline IS NULL);

-- Recalculate SLA deadlines for complaints missing them
UPDATE complaints
SET sla_deadline = calculate_sla_deadline(urgency, created_at)
WHERE sla_deadline IS NULL AND status NOT IN ('closed', 'rejected');
```
