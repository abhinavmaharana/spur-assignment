# Fix Render Backend Deployment Error

## Problem
Render backend deployment fails due to incorrect configuration.

## Solution: Configure Node.js Deployment

### Step 1: Update Render Configuration

In your Render dashboard for the backend service:

1. Go to **Settings** → **Service Details**
2. Find **Environment** section
3. Set **Environment** to `Node`
4. Configure these fields:
   - **Root Directory**: `backend` ⚠️ **CRITICAL**: Set this first
   - **Build Command**: `npm install && npm run build` (NO `cd backend &&` needed - Root Directory handles this)
   - **Start Command**: `npm start` (NO `cd backend &&` needed)
   
   **Important**: When Root Directory is set to `backend`, Render runs all commands from that directory, so you don't need `cd backend &&` in the commands.

### Step 2: Verify Environment Variables

Make sure you have these environment variables set:

```
DATABASE_URL=<your-postgresql-connection-string>
GEMINI_API_KEY=<your-gemini-api-key>
PORT=4000
NODE_ENV=production
CORS_ORIGIN=<your-frontend-url>
```

### Step 3: Save and Redeploy

- Click "Save Changes"
- Render will automatically trigger a new deployment
- Monitor the logs to ensure it builds successfully

---

## Quick Checklist

For Node.js deployment:
- [ ] Environment set to `Node`
- [ ] Root Directory set to `backend`
- [ ] Build Command: `npm install && npm run build` (NO `cd backend &&`)
- [ ] Start Command: `npm start` (NO `cd backend &&`)
- [ ] All environment variables configured
- [ ] Service redeployed successfully

