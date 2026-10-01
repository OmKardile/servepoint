# TSOS Research & Architecture Specifications

This directory contains research papers, technical analyses, security threat models, and architectural deep-dives for the **TSOS Multi-Tenant Cafe Operating System**.

---

## Index of Research Documents

| Document | Title | Focus Area | Date |
|---|---|---|---|
| **[01-qr-table-session-security-and-threat-model.md](01-qr-table-session-security-and-threat-model.md)** | QR Table Session Security & Threat Model | Cryptographic session tokens, accidental remote ordering prevention, auto-lock overlay | 2026-09-25 |
| **[02-multi-tenant-saas-architecture-and-scaling.md](02-multi-tenant-saas-architecture-and-scaling.md)** | Multi-Tenant B2B SaaS Architecture & Scaling Model | PostgreSQL RLS query planner, connection pooling, high-concurrency rush hour design | 2026-09-25 |

---

## Architectural Guidelines

All research conducted in this directory is grounded in real-world hospitality operating realities:
1. **Zero Downtime During Lunch Rush**: Architectural decisions prioritize simplicity, atomic ACID database transactions, and offline fallbacks.
2. **Strict Financial Integrity**: Tax rounding, platform fee calculations, and loyalty point redemptions are verified server-side.
3. **Hardware Agnostic**: Designs support low-cost Android tablets, iPads, Windows touch registers, and mobile phone browsers without proprietary vendor lock-in.
