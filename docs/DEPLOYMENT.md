# Deployment Guide

This document provides comprehensive instructions for deploying the Digital Complaint Management System to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                    (Nginx / Cloud LB)                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│    Frontend (Next.js)   │     │   Backend (Express.js)  │
│      Port: 3000         │     │       Port: 4000        │
│    Static + SSR         │     │      REST API           │
└─────────────────────────┘     └───────────┬─────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                             │                             │
              ▼                             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│    Supabase             │   │    Gemini AI API        │   │    n8n Cloud            │
│    (PostgreSQL + Auth)  │   │    (Classification)     │   │    (Workflows)          │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account with project created
- Google Cloud account with Gemini API access
- n8n Cloud account or self-hosted n8n
- Domain name with SSL certificate
- Server (VPS/Cloud VM) with:
  - Ubuntu 22.04 LTS
  - 2+ vCPUs, 4GB+ RAM
  - 20GB+ storage

## Environment Setup

### 1. Supabase Setup

1. Create a new Supabase project
2. Navigate to SQL Editor
3. Run the database schema:
   ```sql
   -- Run in order:
   -- 1. database/schema.sql
   -- 2. database/rls-policies.sql
   -- 3. database/seed.sql
   ```
4. Get credentials from Settings > API:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Save as `GEMINI_API_KEY`

### 3. n8n Setup

1. Create n8n Cloud account or self-host
2. Import workflows from `n8n-workflows/` directory
3. Configure credentials and environment variables
4. Copy webhook URLs

## Server Setup

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Clone and Build

```bash
# Clone repository
git clone <repository-url> /opt/complaint-system
cd /opt/complaint-system

# Backend setup
cd backend
pnpm install
pnpm build

# Frontend setup
cd ../frontend
pnpm install
pnpm build
```

### Configure Environment Variables

**Backend (`/opt/complaint-system/backend/.env`)**:
```env
NODE_ENV=production
PORT=4000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# n8n Webhooks
N8N_BASE_URL=https://your-n8n-instance.com
N8N_COMPLAINT_ROUTING_WEBHOOK=https://your-n8n/webhook/xxx
N8N_STATUS_CHANGE_WEBHOOK=https://your-n8n/webhook/xxx
N8N_SLA_CHECK_WEBHOOK=https://your-n8n/webhook/xxx

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

**Frontend (`/opt/complaint-system/frontend/.env.local`)**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### Nginx Configuration

Create `/etc/nginx/sites-available/complaint-system`:

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS
        add_header Access-Control-Allow-Origin "https://your-domain.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Max-Age 86400;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

Enable configuration:
```bash
sudo ln -s /etc/nginx/sites-available/complaint-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificates

```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

### PM2 Process Management

Create `/opt/complaint-system/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'complaint-api',
      cwd: '/opt/complaint-system/backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: '/var/log/complaint-system/api-error.log',
      out_file: '/var/log/complaint-system/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M'
    },
    {
      name: 'complaint-frontend',
      cwd: '/opt/complaint-system/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/complaint-system/frontend-error.log',
      out_file: '/var/log/complaint-system/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M'
    }
  ]
};
```

Start applications:
```bash
sudo mkdir -p /var/log/complaint-system
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring

### PM2 Monitoring
```bash
pm2 status
pm2 logs
pm2 monit
```

### Log Rotation
Create `/etc/logrotate.d/complaint-system`:
```
/var/log/complaint-system/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Health Checks

Create a monitoring script `/opt/complaint-system/healthcheck.sh`:
```bash
#!/bin/bash

API_URL="http://localhost:4000/api/health"
FRONTEND_URL="http://localhost:3000"

# Check API
if curl -s -o /dev/null -w "%{http_code}" "$API_URL" | grep -q "200"; then
    echo "API: OK"
else
    echo "API: FAILED"
    pm2 restart complaint-api
fi

# Check Frontend
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    echo "Frontend: OK"
else
    echo "Frontend: FAILED"
    pm2 restart complaint-frontend
fi
```

Add to crontab:
```bash
*/5 * * * * /opt/complaint-system/healthcheck.sh >> /var/log/complaint-system/healthcheck.log 2>&1
```

## Backup Strategy

### Database Backup (Supabase)
- Supabase handles automatic daily backups
- For additional backups, use pg_dump with connection string

### Application Backup
```bash
#!/bin/bash
BACKUP_DIR="/backups/complaint-system"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/complaint-system

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

## Security Checklist

- [ ] All environment variables secured (not in version control)
- [ ] SSL/TLS enabled for all endpoints
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers set in Nginx
- [ ] Database RLS policies enabled
- [ ] API authentication required for protected routes
- [ ] Logs don't contain sensitive data
- [ ] Regular security updates applied
- [ ] Firewall configured (only 80/443 open)

## Rollback Procedure

```bash
# Stop services
pm2 stop all

# Restore previous version
cd /opt/complaint-system
git fetch origin
git checkout <previous-commit-hash>

# Rebuild
cd backend && pnpm install && pnpm build
cd ../frontend && pnpm install && pnpm build

# Restart
pm2 restart all
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (AWS ALB, Nginx, etc.)
- Run multiple instances of backend
- Use Redis for session storage

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add database indexes

### CDN
- Use Cloudflare or AWS CloudFront
- Cache static assets
- Enable compression

## Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs complaint-api --lines 100

# Check system resources
htop
df -h

# Verify Node.js version
node --version
```

### Database Connection Issues
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your-anon-key"
```

### High Memory Usage
```bash
# Check process memory
pm2 monit

# Restart services
pm2 restart all
```
