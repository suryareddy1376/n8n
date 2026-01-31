# AI-Powered Digital Complaint Management System (DCMS)

## 🏛️ Overview

A production-grade, AI-powered complaint management system designed for government/civic use cases. The system enables citizens to submit complaints digitally, automatically classifies them using AI, routes them to correct departments, tracks SLA compliance, and provides comprehensive analytics.

## 🎯 Key Features

- **AI-Powered Classification**: Gemini API for automatic department routing and urgency detection
- **Confidence-Based Approval**: Auto-approve high-confidence classifications, manual review for low-confidence
- **SLA Enforcement**: Automatic escalation for breached SLAs
- **Role-Based Access**: Citizens, Department Users, and Admins with granular permissions
- **Audit Trail**: Complete event logging for compliance and analytics
- **Real-time Notifications**: Status updates via email/SMS (mock-ready)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Citizen UI  │  │ Department UI   │  │        Admin Dashboard          │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js/Express)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth Service │  │ Complaint API│  │ AI Classifier│  │ Webhook Handler│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ SLA Monitor  │  │ Escalation   │  │ Analytics    │  │ Priority Score │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                          │                      │
                          ▼                      ▼
┌─────────────────────────────────┐  ┌──────────────────────────────────────┐
│         SUPABASE                │  │              n8n CLOUD                │
│  ┌─────────────────────────┐   │  │  ┌──────────────────────────────────┐│
│  │ PostgreSQL + RLS        │   │  │  │ Workflow 1: Complaint Routing   ││
│  │ Auth (JWT)              │   │  │  │ Workflow 2: SLA Monitor         ││
│  │ Storage (Images)        │   │  │  │ Workflow 3: Notifications       ││
│  └─────────────────────────┘   │  │  └──────────────────────────────────┘│
└─────────────────────────────────┘  └──────────────────────────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │   GEMINI API     │
                                   └──────────────────┘
```

## 📁 Project Structure

```
dcms/
├── backend/                           # Node.js Express API
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts              # Environment configuration with Zod
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT authentication
│   │   │   ├── errorHandler.ts       # Global error handling
│   │   │   ├── rateLimiter.ts        # Rate limiting configs
│   │   │   └── validation.ts         # Zod validation schemas
│   │   ├── routes/
│   │   │   ├── analytics.ts          # Analytics endpoints
│   │   │   ├── complaints.ts         # Complaint CRUD & workflow
│   │   │   ├── departments.ts        # Department management
│   │   │   ├── users.ts              # User profile & notifications
│   │   │   ├── webhooks.ts           # n8n webhook handlers
│   │   │   └── index.ts              # Route aggregation
│   │   ├── services/
│   │   │   ├── aiClassification.ts   # Gemini AI integration
│   │   │   ├── complaintService.ts   # Core complaint logic
│   │   │   ├── slaService.ts         # SLA monitoring & escalation
│   │   │   ├── webhookService.ts     # n8n webhook client
│   │   │   └── analyticsService.ts   # Dashboard metrics
│   │   ├── utils/
│   │   │   ├── supabase.ts           # Supabase client setup
│   │   │   ├── logger.ts             # Winston logger
│   │   │   ├── errors.ts             # Custom error classes
│   │   │   └── helpers.ts            # Priority scoring, SLA calc
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript definitions
│   │   └── index.ts                  # Express server entry
│   ├── package.json
│   └── tsconfig.json
├── frontend/                          # Next.js 14 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── login/page.tsx        # Login form
│   │   │   ├── register/page.tsx     # Registration form
│   │   │   ├── layout.tsx            # Root layout with providers
│   │   │   ├── globals.css           # Tailwind styles
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx        # Dashboard shell + sidebar
│   │   │       ├── page.tsx          # Role-based dashboard
│   │   │       ├── complaints/
│   │   │       │   ├── page.tsx      # Complaints list
│   │   │       │   ├── new/page.tsx  # Submit complaint form
│   │   │       │   └── [id]/page.tsx # Complaint detail
│   │   │       ├── review/page.tsx   # Admin review queue
│   │   │       ├── analytics/page.tsx# Analytics dashboard
│   │   │       ├── sla/page.tsx      # SLA monitoring
│   │   │       ├── notifications/    # Notifications page
│   │   │       └── settings/page.tsx # User settings
│   │   ├── components/
│   │   │   └── providers/
│   │   │       ├── QueryProvider.tsx # React Query setup
│   │   │       └── AuthProvider.tsx  # Auth initialization
│   │   ├── lib/
│   │   │   ├── supabase.ts           # Supabase client
│   │   │   └── api.ts                # Axios API client
│   │   ├── store/
│   │   │   └── authStore.ts          # Zustand auth state
│   │   └── types/
│   │       └── index.ts              # Frontend types
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── database/
│   ├── schema.sql                    # Full PostgreSQL schema (11 tables)
│   ├── rls-policies.sql              # Row Level Security policies
│   └── seed.sql                      # Initial departments & config
├── n8n-workflows/
│   ├── complaint-routing.json        # AI routing workflow
│   ├── sla-monitoring.json           # SLA breach detection
│   ├── status-notifications.json     # Multi-channel notifications
│   ├── daily-report.json             # Daily analytics email
│   └── README.md                     # Workflow setup guide
├── docs/
│   ├── API.md                        # Complete API documentation
│   ├── DEPLOYMENT.md                 # Production deployment guide
│   └── FAILURE-SCENARIOS.md          # Error handling & recovery
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- n8n Cloud account
- Gemini API key

### Environment Setup

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
3. Configure environment variables (see Configuration section)

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Database Setup

1. Create a Supabase project
2. Run `database/schema.sql` in Supabase SQL editor
3. Run `database/rls-policies.sql` for security policies
4. Run `database/seed.sql` for initial data

## 🔐 Security Features

- JWT-based authentication via Supabase Auth
- Row Level Security (RLS) on all tables
- API rate limiting (100 req/min per user)
- Webhook secret validation
- Input sanitization and validation
- No secrets in frontend code

## 📊 Metrics & Analytics

- Average resolution time
- SLA compliance percentage
- Complaints by department
- AI auto-approval rate
- Escalation frequency
- Geographic distribution

## � n8n Workflows

The system uses 4 n8n workflows for automation:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| Complaint Routing | Webhook | Routes complaints based on AI confidence |
| SLA Monitoring | Every 15 min | Detects breaches and triggers escalations |
| Status Notifications | Webhook | Sends multi-channel notifications |
| Daily Report | Daily 8 AM | Generates analytics email for admins |

## ⚙️ Configuration

### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key | ✅ |
| `N8N_COMPLAINT_ROUTING_WEBHOOK` | n8n routing webhook URL | ✅ |
| `N8N_STATUS_CHANGE_WEBHOOK` | n8n notification webhook URL | ✅ |
| `PORT` | API server port (default: 4000) | ❌ |
| `CORS_ORIGIN` | Allowed CORS origin | ❌ |

### Frontend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `NEXT_PUBLIC_API_URL` | Backend API URL | ✅ |

## 🚀 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive deployment instructions including:
- Server setup (Ubuntu/Nginx/PM2)
- SSL configuration
- Environment configuration
- Monitoring setup
- Backup strategies

## ❌ Failure Scenarios

See [docs/FAILURE-SCENARIOS.md](docs/FAILURE-SCENARIOS.md) for:
- Database connection failures
- AI classification failures
- n8n webhook failures
- Authentication failures
- SLA monitoring failures
- Data consistency issues
- Recovery runbooks

## 📚 API Documentation

See [docs/API.md](docs/API.md) for complete API reference including:
- All endpoints with request/response examples
- Authentication requirements
- Error codes and handling
- Rate limiting information

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## �📄 License

MIT License - See LICENSE file for details
