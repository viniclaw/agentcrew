# Deploying AgentCrew to Vercel

## Prerequisites

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

## Deploy API First

```bash
cd packages/api
vercel --prod
```

When prompted:
- **Project name**: `agentcrew-api`
- **Directory**: `./` (current)
- Set environment variables:
  ```
  CREW_TOKEN_ADDRESS=0x263eB8ac7bc24DD66ac613717a95D81E758A2b07
  ```

After deployment, note the URL (e.g., `https://agentcrew-api.vercel.app`).

## Deploy Frontend

Update the API URL in your environment:

```bash
cd packages/nextjs
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://agentcrew-api.vercel.app
NEXT_PUBLIC_CREW_TOKEN=0x263eB8ac7bc24DD66ac613717a95D81E758A2b07
```

Deploy:
```bash
vercel --prod
```

When prompted:
- **Project name**: `agentcrew`
- **Directory**: `./` (current)

## One-Command Deploy (After Setup)

```bash
# From root
cd packages/api && vercel --prod && cd ../nextjs && vercel --prod
```

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

## Troubleshooting

### CORS Issues
If you get CORS errors, update the API's CORS_ORIGIN env variable to your frontend URL:
```
CORS_ORIGIN=https://agentcrew.vercel.app
```

### API 404 Errors
Make sure the API is deployed and the `NEXT_PUBLIC_API_URL` is correct.

### Build Failures
- Clear `.next` and `node_modules`
- Reinstall: `npm install`
- Retry deploy
