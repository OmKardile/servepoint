# TSOS Architecture Decision Records (ADRs)

This directory documents all key architectural decisions made in the development of the **TSOS Multi-Tenant Cafe Operating System**.

---

## Index of Decisions

| ADR Number | Title | Status | Date |
|---|---|---|---|
| **[ADR 0001](0001-supabase-multi-tenant-architecture.md)** | Supabase Multi-Tenant Architecture | Accepted | 2026-09-25 |
| **[ADR 0002](0002-rls-tenant-isolation-model.md)** | Row-Level Security (RLS) Tenant Isolation Model | Accepted | 2026-09-25 |
| **[ADR 0003](0003-production-chrome-purge-and-dynamic-routing.md)** | Production Chrome Purge and Dynamic Scoped Routing | Accepted | 2026-09-25 |
| **[ADR 0004](0004-obsidian-terminal-theme-engine.md)** | Obsidian Terminal Theme Engine | Accepted | 2026-09-25 |
| **[ADR 0005](0005-ephemeral-table-qr-session-security.md)** | 10-Minute Ephemeral Table QR Session Security | Accepted | 2026-09-25 |
| **[ADR 0006](0006-realtime-websockets-and-selective-migration.md)** | Real-Time WebSockets & Selective Architectural Migration | Accepted | 2026-09-25 |
| **[ADR 0007](0007-remove-hardware-hub-and-cancel-native-apps.md)** | Removal of Hardware Hub, Freezing Windows for Electron & Browser QR Ordering | Accepted | 2026-09-25 |
| **[ADR 0008](0008-cloud-deployment-render-and-vercel.md)** | Multi-Platform Cloud Deployment via Render Static Sites and Vercel Edge | Accepted | 2026-09-25 |
| **[ADR 0009](0009-role-based-access-control-and-route-guards.md)** | Role-Based Access Control (RBAC), Tab Filtering, and Route Guards | Accepted | 2026-09-25 |
| **[ADR 0010](0010-login-screen-design-freeze-and-design-system-directives.md)** | Login Screen Design Freeze & Design System Directives (Surface Pack illustrations reserved for login; shadcn/ui reference post-login) | Accepted | 2026-10-01 |
| **[ADR 0011](0011-servepoint-ui-adoption.md)** | ServePoint UI Adoption — owner Figma as the default post-login design (auth-scoped Tessera pin keeps login frozen) | Accepted | 2026-10-01 |
| **[ADR 0012](0012-figma-rest-pipeline-and-exact-servepoint-tokens.md)** | Figma REST Pipeline & Exact ServePoint Design Tokens (PAT custody, 57-frame archive, estimated → mined tokens) | Accepted | 2026-10-01 |
| **[ADR 0013](0013-three-role-model-and-credentials-only-login.md)** | Three-Role Model (superadmin / owner / staff) & Credentials-Only Login (supersedes ADR-0009 role matrix; unfreezes ADR-0010 login scope) | Accepted | 2026-10-01 |
| **[ADR 0014](0014-production-rebuild-app-equals-figma.md)** | Production Rebuild — App Equals the Figma (demo/dev purge, single theme, Supabase-only data) | Accepted | 2026-10-01 |

---

## Architectural Decision Framework

Each ADR follows the standard format:
1. **Context**: Why the decision was needed and what problem we faced.
2. **Decision**: What architectural or engineering choice was implemented.
3. **Consequences**: Positive benefits and negative trade-offs of the decision.
