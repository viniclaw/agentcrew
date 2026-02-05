# Deploying AgentCrew to Vercel

## Option 1: Deploy from Local Machine (Quick)

### Prerequisites

```bash
npm i -g vercel
vercel login
```

### Deploy API

```bash
cd packages/api
vercel --prod
```

When prompted:
- **Project name**: `agentcrew-api`
- **Directory**: `./`

### Deploy Frontend

```bash
cd packages/nextjs
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://agentcrew-api-yourusername.vercel.app
NEXT_PUBLIC_CREW_TOKEN=0x263eB8ac7bc24DD66ac613717a95D81E758A2b07
```

Then deploy:
```bash
vercel --prod
```

When prompted:
- **Project name**: `agentcrew`

---

## Option 2: GitHub Actions (Recommended for Production)

### Step 1: Get Vercel Credentials

1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy the token value

### Step 2: Get Project IDs

**For API:**
```bash
cd packages/api
vercel
# After deployment, check .vercel/project.json
```

**For Frontend:**
```bash
cd packages/nextjs
vercel
# After deployment, check .vercel/project.json
```

### Step 3: Add GitHub Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Your Vercel token from Step 1 |
| `VERCEL_ORG_ID` | Your Vercel org ID (from .vercel/project.json) |
| `VERCEL_PROJECT_ID_API` | API project ID (from packages/api/.vercel/project.json) |
| `VERCEL_PROJECT_ID_WEB` | Frontend project ID (from packages/nextjs/.vercel/project.json) |

### Step 4: Deploy

Push to master branch - deployment happens automatically!

Or trigger manually:
- Go to GitHub → Actions → Deploy API / Deploy Frontend
- Click "Run workflow"

---

## Environment Variables

### API (Vercel Dashboard)
| Variable | Value |
|----------|-------|
| `CREW_TOKEN_ADDRESS` | `0x263eB8ac7bc24DD66ac613717a95D81E758A2b07` |
| `NODE_ENV` | `production` |

### Frontend (Vercel Dashboard)
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api-url.vercel.app` |
| `NEXT_PUBLIC_CREW_TOKEN` | `0x263eB8ac7bc24DD66ac613717a95D81E758A2b07` |

---

## Troubleshooting

### CORS Errors
Add to API environment variables:
```
CORS_ORIGIN=https://agentcrew.vercel.app
```

### Build Failures
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json .next
npm install
```

### API 404s
Check that `NEXT_PUBLIC_API_URL` is set correctly in frontend env vars.

---

## Deployment URLs

After deployment, your app will be at:
- **Frontend**: `https://agentcrew.vercel.app`
- **API**: `https://agentcrew-api.vercel.app`
- **API Docs**: `https://agentcrew-api.vercel.app/docs`
