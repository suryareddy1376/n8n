# Render Deployment Guide for DCMS Backend

## Step 1: Push Code to GitHub

First, make sure your code is pushed to GitHub:

```bash
cd "c:\Users\surya\Hackathons\AL CH"
git add .
git commit -m "Add Render deployment config"
git push origin main
```

## Step 2: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select the `backend` folder or configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

## Step 3: Add Environment Variables in Render

In Render dashboard → Your Service → **Environment**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `API_VERSION` | `v1` |
| `SUPABASE_URL` | `https://ryeegvagbtnpswkcmkwq.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your key) |
| `GEMINI_API_KEY` | `AIzaSyCBhRgEx5sdI9sbrq517c2uKEALp3c16tY` |
| `GEMINI_MODEL` | `gemini-1.5-flash` |
| `AI_CONFIDENCE_THRESHOLD` | `0.75` |
| `N8N_WEBHOOK_BASE_URL` | `https://skylinestars.app.n8n.cloud/webhook` |
| `N8N_WEBHOOK_SECRET` | `dcms-webhook-secret-change-in-production` |
| `JWT_SECRET` | `dcms-jwt-secret-change-in-production` |
| `WEBHOOK_SECRET` | `dcms-webhook-secret-change-in-production` |
| `CORS_ORIGINS` | `http://localhost:3000,https://your-frontend.vercel.app` |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `LOG_LEVEL` | `info` |

## Step 4: Get Your Render URL

After deployment, you'll get a URL like:
```
https://dcms-backend-xxxx.onrender.com
```

## Step 5: Update n8n Workflows

Since you can't use environment variables in n8n free plan, you need to **manually update each HTTP Request node** in your workflows:

### For each workflow:
1. Open the workflow in n8n
2. Click on each **HTTP Request node** (Auto Approve, Notify, etc.)
3. Change the URL from:
   ```
   {{ $env.BACKEND_URL }}/api/...
   ```
   To:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/...
   ```

### Nodes to update in each workflow:

**Complaint Routing:**
- Auto Approve Complaint: `https://YOUR-URL.onrender.com/api/v1/complaints/{{ $json.payload.complaint_id }}/approve`
- Notify Admin for Review: `https://YOUR-URL.onrender.com/api/v1/webhooks/notify`
- Send Critical Alert: `https://YOUR-URL.onrender.com/api/v1/webhooks/notify`
- Notify Department: `https://YOUR-URL.onrender.com/api/v1/webhooks/notify`

**SLA Monitoring:**
- Check SLA Breaches: `https://YOUR-URL.onrender.com/api/v1/webhooks/sla-check`
- Create Escalation: `https://YOUR-URL.onrender.com/api/v1/webhooks/escalate`
- Notify SLA Breach: `https://YOUR-URL.onrender.com/api/v1/webhooks/notify`

**Status Notifications:**
- Send Email: `https://YOUR-URL.onrender.com/api/v1/webhooks/send-email`
- Send SMS: `https://YOUR-URL.onrender.com/api/v1/webhooks/send-sms`
- Create In-App Notification: `https://YOUR-URL.onrender.com/api/v1/webhooks/in-app-notification`

**Daily Report:**
- Fetch Dashboard Stats: `https://YOUR-URL.onrender.com/api/v1/analytics/dashboard`
- Fetch Department Stats: `https://YOUR-URL.onrender.com/api/v1/analytics/departments`
- Send Report Email: `https://YOUR-URL.onrender.com/api/v1/webhooks/send-email`

## Step 6: Remove Credential Requirements

Since n8n free plan doesn't support credentials, update the HTTP nodes to use **Header Parameters** instead:

1. Click on each HTTP Request node
2. Go to **Options** → **Add Option** → **Headers**
3. Add header:
   - **Name**: `X-Webhook-Secret`
   - **Value**: `dcms-webhook-secret-change-in-production`

## Step 7: Update Frontend .env.local

Update your frontend to use the Render backend:

```env
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL.onrender.com
```

## Step 8: Test

Test the backend health:
```powershell
Invoke-RestMethod -Uri "https://YOUR-RENDER-URL.onrender.com/api/v1/health"
```

---

## Quick Reference: Your Values

| Config | Value |
|--------|-------|
| Supabase URL | `https://ryeegvagbtnpswkcmkwq.supabase.co` |
| n8n Instance | `https://skylinestars.app.n8n.cloud` |
| Webhook Secret | `dcms-webhook-secret-change-in-production` |
