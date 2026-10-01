# TSOS Architecture & Documentation Repository

Welcome to the central documentation hub for **TSOS (The Cafe Operating System)** — an enterprise-grade, multi-tenant B2B SaaS platform for cafes, specialty coffee shops, and quick-service restaurants (QSRs).

---

## Directory Navigation

```
docs/
├── compacts/               # Chronological conversation milestones & progress snapshots
│   ├── compact1.md         # SaaS Blueprint & Multi-Tenant Briefing
│   ├── compact2.md         # Supabase Database Migration & RLS Security
│   ├── compact3.md         # Production Go-On Conversion & Chrome Purge
│   ├── compact4.md         # Obsidian Mode & Global Theme Engine
│   ├── compact5.md         # 10-Minute Ephemeral Table QR Session Security
│   ├── compact6.md         # Comparative Audit & Selective Feature Migration
│   ├── compact7.md         # Hardware Hub Purge & Electron Strategy Pivot
│   └── README.md           # Index of Compacts
├── requests/               # Chronological log of all engineering requests & prompts
│   └── request-history.md  # Detailed prompt ledger & requirements breakdown
├── decisions/              # Architectural Decision Records (ADRs)
│   ├── 0001-supabase-multi-tenant-architecture.md
│   ├── 0002-rls-tenant-isolation-model.md
│   ├── 0003-production-chrome-purge-and-dynamic-routing.md
│   ├── 0004-obsidian-terminal-theme-engine.md
│   ├── 0005-ephemeral-table-qr-session-security.md
│   ├── 0006-realtime-websockets-and-selective-migration.md
│   ├── 0007-remove-hardware-hub-and-cancel-native-apps.md
│   ├── 0008-cloud-deployment-render-and-vercel.md
│   ├── 0009-role-based-access-control-and-route-guards.md
│   └── README.md           # Index of ADRs
├── worklog/                # Daily engineering logs, commit history, and tests
│   └── 2026-09-25.md       # Full engineering log for September 25, 2026
├── research/               # Deep-dive security research & scaling models
│   ├── 01-qr-table-session-security-and-threat-model.md
│   ├── 02-multi-tenant-saas-architecture-and-scaling.md
│   └── README.md           # Index of Research
│   # Platform subsystem specifications (live directly in docs/, not a subfolder):
├── CLOUD_SYNC_AND_OFFLINE_RESILIENCE.md
├── INVENTORY_SUPPLY_CHAIN_AND_ANALYTICS_SPEC.md
├── LOYALTY_SYSTEM_ARCHITECTURE.md
├── MASTER_REPLICATION_PROMPT_FOR_AI.md
├── MOBILE_NATIVE_CLIENTS_ANDROID_IOS_SPEC.md
├── PRINTER_INTEGRATION_SPECIFICATION.md
├── SURFACES_AND_ARCHITECTURE_MAP.md
├── SYSTEM_GUIDANCE_AND_ONBOARDING_SPEC.md
├── TABLE_SIDE_ORDERING_AND_QR_CLIENT_SPEC.md
└── WINDOWS_NATIVE_CLIENT_SPECIFICATION.md
```

---

## Root Documentation Reference

For high-level project documentation, refer to the root documents:
- **[CHANGELOG.md](/CHANGELOG.md)**: Semantic versioning release log and feature ledger.
- **[README.md](/README.md)**: Quickstart, tech stack, and system architecture summary.
- **[technical-documentation.md](/technical-documentation.md)**: Deep technical architecture guide, schema, and API specs.
- **[business-documentation.md](/business-documentation.md)**: Multi-tenant SaaS business model, pricing, unit economics, and operator ROI.
