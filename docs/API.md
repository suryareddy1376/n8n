# API Documentation

## Base URL
```
Production: https://api.your-domain.com
Development: http://localhost:4000
```

## Authentication

All API endpoints (except health check) require authentication via JWT token.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Getting a Token
Tokens are obtained through Supabase Auth and included automatically by the frontend.

---

## Endpoints

### Health Check

#### `GET /api/health`
Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

---

## Complaints

### Create Complaint

#### `POST /api/complaints`

**Required Role:** `citizen`

**Request Body:**
```json
{
  "description": "Large pothole on Main Street causing traffic issues",
  "location": "123 Main Street, Near City Park",
  "category": "road_damage",         // Optional - AI will classify if not provided
  "urgency": "high",                  // Optional - AI will classify if not provided
  "latitude": 40.7128,                // Optional
  "longitude": -74.0060               // Optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "description": "Large pothole on Main Street...",
    "location": "123 Main Street, Near City Park",
    "category": "road_damage",
    "urgency": "high",
    "status": "approved",
    "ai_confidence": 0.92,
    "priority_score": 75,
    "is_critical": false,
    "department_id": "dept-uuid",
    "sla_deadline": "2024-01-17T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Notes:**
- If AI confidence < 0.75, status will be `pending_review`
- If AI confidence >= 0.75, status will be `approved` and routed automatically

---

### List Complaints

#### `GET /api/complaints`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| status | string | Filter by status (comma-separated) |
| urgency | string | Filter by urgency |
| category | string | Filter by category |
| department_id | uuid | Filter by department |
| search | string | Search in description |
| sla_status | string | `breached`, `at_risk`, `on_track` |
| is_critical | boolean | Filter critical area complaints |

**Example:**
```
GET /api/complaints?status=assigned,in_progress&urgency=high&page=1&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "description": "...",
      "status": "in_progress",
      "urgency": "high",
      "category": "road_damage",
      "location": "123 Main Street",
      "sla_deadline": "2024-01-17T10:30:00Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "total_pages": 5
  }
}
```

---

### Get Single Complaint

#### `GET /api/complaints/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "description": "Large pothole on Main Street...",
    "location": "123 Main Street, Near City Park",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "category": "road_damage",
    "urgency": "high",
    "status": "in_progress",
    "ai_confidence": 0.92,
    "priority_score": 75,
    "is_critical": false,
    "department_id": "dept-uuid",
    "assigned_to": "officer-uuid",
    "resolution_notes": null,
    "citizen_feedback": null,
    "citizen_satisfaction": null,
    "sla_deadline": "2024-01-17T10:30:00Z",
    "resolved_at": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

---

### Approve Complaint

#### `POST /api/complaints/:id/approve`

**Required Role:** `admin`

**Request Body:**
```json
{
  "department_id": "dept-uuid",        // Optional - uses AI-assigned if not provided
  "assigned_to": "officer-uuid",       // Optional
  "notes": "Approved after verification"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Complaint approved and routed successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "department_id": "dept-uuid"
  }
}
```

---

### Update Complaint Status

#### `PATCH /api/complaints/:id/status`

**Required Role:** `department`, `admin`

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Work crew dispatched to location"
}
```

**Valid Status Transitions:**
| From | To |
|------|-----|
| pending_review | approved, rejected |
| approved | assigned |
| assigned | in_progress |
| in_progress | resolved, escalated |
| resolved | closed |
| escalated | in_progress, resolved |

**Response (200):**
```json
{
  "success": true,
  "message": "Status updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "updated_at": "2024-01-15T14:00:00Z"
  }
}
```

---

### Submit Feedback

#### `POST /api/complaints/:id/feedback`

**Required Role:** `citizen` (owner only)

**Prerequisites:** Complaint status must be `resolved`

**Request Body:**
```json
{
  "satisfaction": 4,
  "feedback": "Issue was fixed quickly. Thank you!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

---

### Reclassify Complaint

#### `POST /api/complaints/:id/reclassify`

**Required Role:** `admin`

**Request Body:**
```json
{
  "category": "water_supply",
  "urgency": "critical",
  "department_id": "new-dept-uuid",
  "reason": "Misclassified by AI - actually a water main break"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Complaint reclassified successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "water_supply",
    "urgency": "critical",
    "department_id": "new-dept-uuid"
  }
}
```

---

### Get Complaint History

#### `GET /api/complaints/:id/history`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-1",
      "complaint_id": "complaint-uuid",
      "old_status": null,
      "new_status": "pending_review",
      "changed_by": "user-uuid",
      "notes": "Complaint submitted",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "log-uuid-2",
      "complaint_id": "complaint-uuid",
      "old_status": "pending_review",
      "new_status": "approved",
      "changed_by": "admin-uuid",
      "notes": "Verified and approved",
      "created_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

## Analytics

### Dashboard Stats

#### `GET /api/analytics/dashboard`

**Required Role:** `admin`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_complaints": 1250,
    "complaints_today": 23,
    "pending_review": 12,
    "in_progress": 156,
    "resolved": 45,
    "sla_breached": 8,
    "sla_compliance_rate": 87.5,
    "resolution_rate": 78.2,
    "avg_resolution_hours": 36.5
  }
}
```

---

### Department Stats

#### `GET /api/analytics/departments`

**Required Role:** `admin`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "department_id": "dept-uuid-1",
      "department_name": "Public Works",
      "total_complaints": 245,
      "open_complaints": 34,
      "breached_complaints": 3,
      "avg_resolution_hours": 28.5
    },
    {
      "department_id": "dept-uuid-2",
      "department_name": "Water Department",
      "total_complaints": 189,
      "open_complaints": 22,
      "breached_complaints": 1,
      "avg_resolution_hours": 42.0
    }
  ]
}
```

---

### Trends

#### `GET /api/analytics/trends`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| range | string | `7d`, `30d`, `90d`, `1y` |

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "date": "2024-01-08", "count": 18 },
    { "date": "2024-01-09", "count": 22 },
    { "date": "2024-01-10", "count": 15 },
    { "date": "2024-01-11", "count": 28 },
    { "date": "2024-01-12", "count": 25 },
    { "date": "2024-01-13", "count": 12 },
    { "date": "2024-01-14", "count": 8 }
  ]
}
```

---

## Departments

### List Departments

#### `GET /api/departments`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "dept-uuid-1",
      "name": "Public Works",
      "description": "Handles roads, bridges, public infrastructure",
      "email": "publicworks@city.gov",
      "phone": "+1-555-0101",
      "head_user_id": "user-uuid",
      "sla_hours_low": 168,
      "sla_hours_medium": 72,
      "sla_hours_high": 24,
      "sla_hours_critical": 4,
      "is_active": true
    }
  ]
}
```

---

## Users

### Get Profile

#### `GET /api/users/profile`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "citizen@example.com",
    "full_name": "John Doe",
    "phone": "+1-555-1234",
    "role": "citizen",
    "department_id": null,
    "notification_preferences": {
      "email": true,
      "sms": false,
      "in_app": true
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update Profile

#### `PATCH /api/users/profile`

**Request Body:**
```json
{
  "full_name": "John Smith",
  "phone": "+1-555-5678",
  "notification_preferences": {
    "email": true,
    "sms": true,
    "in_app": true
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

### Get Notifications

#### `GET /api/users/notifications`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Filter unread only |
| limit | number | Number of notifications |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid",
      "type": "status_update",
      "title": "Complaint Status Updated",
      "message": "Your complaint has been resolved",
      "complaint_id": "complaint-uuid",
      "is_read": false,
      "created_at": "2024-01-15T14:00:00Z"
    }
  ]
}
```

---

## Webhooks (Internal)

### SLA Check

#### `GET /api/webhooks/sla-check`

**Required:** System API Key

**Response (200):**
```json
{
  "success": true,
  "data": {
    "breached_count": 5,
    "breached_complaints": [
      {
        "id": "complaint-uuid",
        "sla_deadline": "2024-01-14T10:00:00Z",
        "escalation_level": "none"
      }
    ]
  }
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description is required",
    "details": [
      {
        "field": "description",
        "message": "Must be at least 20 characters"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing or invalid auth token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict (e.g., duplicate) |
| INVALID_STATUS_TRANSITION | 422 | Invalid status change |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | External service unavailable |

---

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 1 minute |
| AI Classification | 10 requests | 1 minute |
| Authentication | 10 requests | 15 minutes |
| File Upload | 5 requests | 1 minute |

Rate limit headers included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705325400
```
