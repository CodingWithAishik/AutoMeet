# Secure Deployment Workflow (Single Path)

Follow these steps in exact order. Do not skip steps.

## Step 1: Create accounts

1. Create a GitHub account. (Dn)
2. Create a MongoDB Atlas account. 
3. Create a Vercel account by signing in with GitHub.

## Step 2: Prepare fresh secrets

Assume old values are leaked. Create brand-new values.

1. In MongoDB Atlas, create a new database user:
   1. Username: `<NEW_DB_USER>`
   2. Password: `<NEW_DB_PASSWORD>`
2. Generate a new JWT secret in PowerShell:

```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
```

Save this as `<NEW_JWT_SECRET_64PLUS>`.

## Step 3: Add Vercel backend routing file

Create this file exactly: `backend/vercel.json`

```json
{
  "version": 2,
  "builds": [
    { "src": "app.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "app.js" }
  ]
}
```

Commit and push this file to GitHub.

## Step 4: Deploy backend project on Vercel

1. Open Vercel Dashboard.
2. Click `Add New` -> `Project`.
3. Import this repository.
4. Set:
   1. Project name: `cs2191-backend` (or your chosen backend name)
   2. Root Directory: `backend`
   3. Framework Preset: `Other`
5. Add backend environment variables:

```env
DB_CONNECT=mongodb+srv://<NEW_DB_USER>:<NEW_DB_PASSWORD>@<NEW_CLUSTER_HOST>/<DB_NAME>?retryWrites=true&w=majority
JWT_SECRET=<NEW_JWT_SECRET_64PLUS>
CORS_ORIGIN=https://placeholder-frontend.vercel.app
NODE_ENV=production
```

6. Apply these vars to both `Production` and `Preview`.
7. Click `Deploy`.
8. Copy deployed backend URL as `<BACKEND_DOMAIN>`.

## Step 5: Deploy frontend project on Vercel

1. Open Vercel Dashboard.
2. Click `Add New` -> `Project`.
3. Import the same repository again.
4. Set:
   1. Project name: `cs2191-frontend` (or your chosen frontend name)
   2. Root Directory: `frontend`
   3. Framework Preset: `Vite`
   4. Build Command: `npm run build`
   5. Output Directory: `dist`
5. Add frontend environment variables:

```env
VITE_BASE_URL=https://<BACKEND_DOMAIN>
VITE_API_URL=https://<BACKEND_DOMAIN>
```

6. Apply these vars to both `Production` and `Preview`.
7. Click `Deploy`.
8. Copy deployed frontend URL as `<FRONTEND_DOMAIN>`.

## Step 6: Lock CORS to the real frontend domain

1. Open backend Vercel project -> `Settings` -> `Environment Variables`.
2. Change `CORS_ORIGIN` to:

```env
https://<FRONTEND_DOMAIN>
```

3. Redeploy backend project.

## Step 7: Remove old leaked access

1. Delete old backend env values from Vercel.
2. Delete old frontend env values from Vercel.
3. Remove old local env files/values from your machine.
4. In MongoDB Atlas, delete the old database user.

## Step 8: Verify deployment

All checks must pass:

1. Frontend opens at `https://<FRONTEND_DOMAIN>`.
2. Login works.
3. Committee dashboard loads.
4. Create MoM works.
5. Generate structured draft works.
6. Save MoM works.
7. Notifications load.
8. Browser network calls go to `https://<BACKEND_DOMAIN>`.
9. No CORS error appears in browser console.
10. Old JWT token no longer works.

## Step 9: Rollback procedure if anything fails

1. Backend Vercel project -> `Deployments` -> redeploy last known-good deployment.
2. Frontend Vercel project -> `Deployments` -> redeploy last known-good deployment.
3. Correct wrong env value.
4. Redeploy in this order:
   1. backend
   2. frontend

## Final variable list (must be changed)

1. `DB_CONNECT`
2. `JWT_SECRET`
3. `CORS_ORIGIN`
4. `NODE_ENV`
5. `VITE_BASE_URL`
6. `VITE_API_URL`
