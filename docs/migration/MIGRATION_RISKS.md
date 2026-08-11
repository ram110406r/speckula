# SPECKULA — Migration Risks & Mitigation Matrix

## 1. High-Risk Migration Matrix

| Risk ID | Category | Risk Description | Potential Impact | Severity | Mitigation Strategy | Rollback Strategy |
|---|---|---|---|---|---|---|
| **RISK-01** | Data Loss | Orphaning legacy Product Brain entries during `orgId` backfill | Unretrievable customer insights | 🔴 **CRITICAL** | Default `organizationId` assignment script with dry-run validation. | Revert query filter to allow `organizationId IS NULL`. |
| **RISK-02** | Security | Broken permission checks during RBAC transition | Unauthorized access to enterprise PRDs | 🔴 **CRITICAL** | Run RBAC engine in `shadow mode` (log denials without blocking) for 48h before enforcement. | Toggle feature flag `ENFORCE_RBAC=false`. |
| **RISK-03** | Performance | Latency spike in `pgvector` queries when joining `ResourcePermission` | Degraded AI response times (> 2s) | 🟠 **HIGH** | Add Composite HNSW / B-Tree index on `(orgId, isPublicToOrg)`. | Fallback to unjoined vector search with post-retrieval filtering. |
| **RISK-04** | Auth / UX | Session invalidation during Firebase Auth to SSO migration | User logouts across extension & app | 🟠 **HIGH** | Maintain backward compatibility for Firebase ID tokens alongside SAML tokens. | Fallback to Google OAuth auth path. |
| **RISK-05** | Integrations | Disconnection of active extension heartbeats | Lost capture data | 🟡 **MEDIUM** | Ensure extension API payload backward compatibility (`workspaceId` optional). | Accept legacy payload format in `/extension/heartbeat`. |

---

## 2. Contingency & Safety Protocols

1. **Pre-Migration Automated Backups**: Full PostgreSQL snapshot and Firestore export taken immediately before executing any database DDL migration.
2. **Feature Flag Kill-Switches**: All new Enterprise routes and RBAC checks wrapped in dynamic environment flags (`ENABLE_ENTERPRISE_TENANCY`, `ENABLE_STRICT_RBAC`).
3. **Shadow Validation Traces**: During backfills, log all dual-read comparison mismatches to Sentry to catch edge-case discrepancies prior to cutover.
