# SPECKULA — Data Mapping & Entity Evolution

## 1. Entity Evolution Strategy

This document specifies the exact mapping between existing SPECKULA database entities and the target Enterprise OS schema.

```text
[ CURRENT ENTITIES ]                      [ TARGET ENTERPRISE ENTITIES ]

Workspace (ownerId, slug)          ──>    Organization (id, name, ownerId)
                                          Workspace (id, orgId, name, slug)

WorkspaceMember (role: string)     ──>    OrganizationMember (id, orgId, userId)
                                          WorkspaceMember (id, workspaceId, userId)
                                          Role (id, orgId, name)
                                          RolePermission (roleId, resource, action)

ProductBrainEntry (userId, wsId)   ──>    KnowledgeNode (id, orgId, wsId, teamId)
                                          SemanticEmbedding (entryId, embedding)

Firestore Decision (docId)         ──>    Decision (id, orgId, wsId, projectId)
                                          DecisionReasoning (decisionId, reasoning)

ActivityLog                        ──>    AuditEvent (id, orgId, actorId, action)
```

---

## 2. Detailed Field-Level Mapping Table

| Current Entity & Field | Target Enterprise Model | Target Field | Type | Transformation Rule / Defaults |
|---|---|---|---|---|
| `Workspace.id` | `Workspace` | `id` | `String` | Retain existing UUID. |
| `Workspace.ownerId` | `Organization` | `ownerId` | `String` | Seeded as owner of auto-created Organization. |
| `Workspace.slug` | `Workspace` | `slug` | `String` | Retained; scoped under `organizationId`. |
| `Workspace.name` | `Organization` | `name` | `String` | Default to `${Workspace.name} Org` during backfill. |
| `WorkspaceMember.userId` | `OrganizationMember` | `userId` | `String` | Upserted to OrganizationMember table. |
| `WorkspaceMember.role` | `UserRoleAssignment` | `roleId` | `String` | `'owner'`/`'admin'` -> `OrgAdminRole`; `'editor'`/`'viewer'` -> `OrgMemberRole`. |
| `ProductBrainEntry.id` | `KnowledgeNode` | `id` | `String` | Retained 1:1. |
| `ProductBrainEntry.workspaceId` | `KnowledgeNode` | `workspaceId` | `String` | Retained; populates `organizationId` via workspace link. |
| `ProductBrainEntry.metadata` | `KnowledgeNode` | `structuredAttributes` | `Json` | Parsed JSON string converted to native JSONB column. |
| `DecisionReasoning.decisionId` | `Decision` | `id` | `String` | Becomes Primary Key of shadow `Decision` table in PostgreSQL. |
| `ActivityLog.action` | `AuditEvent` | `action` | `String` | Mapped to standardized event type (e.g. `workspace.updated`). |
