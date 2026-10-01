# ADR 0008: Multi-Platform Cloud Deployment via Render Static Sites and Vercel Edge

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead DevOps Engineer & Principal Architect

---

## Context
As TSOS advances from local development to production rollout, a reliable, performant, and cost-effective hosting strategy is required. The platform has dynamic client-side routes (`/:slug/pos`, `/:slug/kds`, `/:slug/t:tableNumber?token=...`, `/superadmin`) and connects directly to a managed Supabase PostgreSQL backend.

We evaluated deployment options including **Render** (render.com) and **Vercel** (vercel.com).

## Evaluation: Render vs. Vercel for TSOS

1. **Architecture Fit**:
   - TSOS is a client-side Vite Single-Page Application (SPA) interfacing with Supabase via REST/WebSockets.
   - On Render, this maps to a **Static Site**, NOT a dynamic Web Service.
   - Render Static Sites run on a global CDN edge network, are **100% free**, and **never sleep** (unlike Render's free Web Services which sleep after 15 minutes of inactivity). This eliminates cold start delays for customers scanning table QR codes.

2. **Client-Side Routing / Deep Linking**:
   - Both platforms require SPA fallback rewrite rules (`/* -> /index.html`) so that requests to `/:slug/pos` or `/:slug/t1?token=...` do not throw 404 HTTP errors on page reload.
   - On Vercel: handled via `vercel.json` rewrites.
   - On Render: handled via `render.yaml` routes (`type: rewrite, source: /*, destination: /index.html`) or manual dashboard rules.

3. **Infrastructure as Code (IaC)**:
   - Render Blueprints (`render.yaml`) enable declarative, 1-click deployment from Git repositories with environment variables pre-configured.

## Decision
1. **Support Dual Cloud Deployment**:
   - Provide first-class support for both **Render** (via `render.yaml`) and **Vercel** (via `vercel.json`).
2. **Deploy as Static Site on Render**:
   - Configure Render strictly as a `static` runtime to take advantage of zero-cost CDN distribution, zero cold starts, and unlimited continuous deployment.
3. **Automate Rewrites**:
   - Standardize `/* -> /index.html` rewrites on all hosting providers.

## Consequences
- **Positive**: Operators can deploy to Render with 1 click via Blueprints without incurring monthly server costs or suffering from 50s cold-start spin-ups.
- **Positive**: Full redundancy across both Render and Vercel edge networks.
- **Neutral**: Production environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be configured in Render/Vercel dashboard or blueprint.
