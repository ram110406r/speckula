# BuildCase Backend API Documentation

## Overview

All endpoints require JWT authentication (except signup/login). Include token in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Base URL: `http://localhost:3001`

## Authentication Endpoints

### POST /auth/signup
Create a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure_password_min_8_chars"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_jwt_token"
  }
}
```

### POST /auth/login
Authenticate and get tokens.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "secure_password_min_8_chars"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_jwt_token"
  }
}
```

### POST /auth/refresh
Refresh your access token.

**Request:**
```json
{
  "refreshToken": "refresh_jwt_token"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "accessToken": "new_jwt_token"
  }
}
```

### GET /auth/me
Get current authenticated user info.

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /auth/logout
Logout and revoke refresh token.

**Request:**
```json
{
  "refreshToken": "refresh_jwt_token"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

## Workspace Endpoints

### POST /workspace/create
Create a new workspace.

**Request:**
```json
{
  "name": "My Product Workspace"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "name": "My Product Workspace",
    "ownerId": "user_uuid",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /workspace/list
List all workspaces (owned + member).

**Response (200):**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "My Product Workspace",
      "ownerId": "user_uuid",
      "createdAt": "2024-01-15T10:30:00Z",
      "_count": {
        "members": 2,
        "projects": 3
      }
    }
  ]
}
```

### GET /workspace/:id
Get workspace details with projects.

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "name": "My Product Workspace",
    "ownerId": "user_uuid",
    "createdAt": "2024-01-15T10:30:00Z",
    "members": [...],
    "projects": [
      {
        "id": "project_uuid",
        "name": "Product v2.0",
        "stage": "Discovery",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### POST /workspace/:id/project/create
Create a project in workspace.

**Request:**
```json
{
  "name": "Product v2.0"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "project_uuid",
    "workspaceId": "workspace_uuid",
    "name": "Product v2.0",
    "stage": "Discovery",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## Notes (Thinking) Endpoints

### POST /notes/create
Create a note in a project.

**Request:**
```json
{
  "projectId": "project_uuid",
  "title": "User Feedback Summary",
  "content": "Users want better performance..."
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "note_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "title": "User Feedback Summary",
    "content": "Users want better performance...",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /notes/:projectId
Get all notes for a project.

**Response (200):**
```json
{
  "ok": true,
  "data": [
    {
      "id": "note_uuid",
      "projectId": "project_uuid",
      "userId": "user_uuid",
      "title": "User Feedback Summary",
      "content": "Users want better performance...",
      "insights": [...],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### PATCH /notes/:id
Update a note.

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "note_uuid",
    "title": "Updated Title",
    "content": "Updated content...",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
}
```

## Insights Endpoints

### POST /insights/create
Create an insight (manual or AI-generated).

**Request:**
```json
{
  "projectId": "project_uuid",
  "noteId": "note_uuid",
  "content": "Performance is the top user concern",
  "source": "AI",
  "confidenceScore": 0.85
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "insight_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "noteId": "note_uuid",
    "content": "Performance is the top user concern",
    "source": "AI",
    "confidenceScore": 0.85,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /insights/:projectId
Get all insights for a project.

**Response (200):**
```json
{
  "ok": true,
  "data": [
    {
      "id": "insight_uuid",
      "projectId": "project_uuid",
      "content": "Performance is the top user concern",
      "source": "AI",
      "confidenceScore": 0.85,
      "note": {
        "id": "note_uuid",
        "title": "User Feedback Summary"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Decision Endpoints

### POST /decision/create
Create a decision.

**Request:**
```json
{
  "projectId": "project_uuid",
  "title": "Monolith vs Microservices",
  "description": "Should we refactor to microservices?"
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "decision_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "title": "Monolith vs Microservices",
    "description": "Should we refactor to microservices?",
    "status": "active",
    "confidenceScore": 0.5,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /tradeoff/create
Create a tradeoff analysis for a decision.

**Request:**
```json
{
  "decisionId": "decision_uuid",
  "optionA": "Keep monolith",
  "optionB": "Migrate to microservices",
  "reasoning": "Microservices offer scalability but increase complexity..."
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "tradeoff_uuid",
    "decisionId": "decision_uuid",
    "optionA": "Keep monolith",
    "optionB": "Migrate to microservices",
    "reasoning": "...",
    "winner": null,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /decision/:id/outcome
Record decision outcome (expected vs actual).

**Request:**
```json
{
  "expectedOutcome": "30% performance improvement",
  "actualOutcome": "42% performance improvement",
  "comparison": "Exceeded expectations",
  "learningInsight": "Optimization had cascading benefits",
  "confidenceAdjustment": 0.15
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "outcome_uuid",
    "decisionId": "decision_uuid",
    "expectedOutcome": "30% performance improvement",
    "actualOutcome": "42% performance improvement",
    "comparison": "Exceeded expectations",
    "learningInsight": "Optimization had cascading benefits",
    "confidenceAdjustment": 0.15,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## PRD Endpoints

### POST /prd/create
Create a PRD.

**Request:**
```json
{
  "projectId": "project_uuid",
  "title": "v2.0 Product Requirements",
  "content": "# Vision\nImprove performance and UX...\n\n# Features\n1. Caching layer\n2..."
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "prd_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "title": "v2.0 Product Requirements",
    "content": "...",
    "version": 1,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## Task Endpoints

### POST /task/create
Create a task.

**Request:**
```json
{
  "projectId": "project_uuid",
  "prdId": "prd_uuid",
  "title": "Implement Redis caching",
  "description": "Add Redis layer for frequently accessed data",
  "priority": "high",
  "dependsOnTaskId": null
}
```

**Response (201):**
```json
{
  "ok": true,
  "data": {
    "id": "task_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "prdId": "prd_uuid",
    "title": "Implement Redis caching",
    "description": "...",
    "status": "todo",
    "priority": "high",
    "dependsOnTaskId": null,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### PATCH /task/:id
Update task status.

**Request:**
```json
{
  "status": "in_progress"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "id": "task_uuid",
    "status": "in_progress",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
}
```

## AI Endpoints

### POST /ai/insights/generate
Trigger AI insight generation for a note.

**Request:**
```json
{
  "projectId": "project_uuid",
  "noteId": "note_uuid"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "status": "queued",
    "message": "Insight generation has been triggered",
    "noteId": "note_uuid"
  }
}
```

### POST /ai/prd/generate
Trigger PRD generation.

**Request:**
```json
{
  "projectId": "project_uuid",
  "title": "v2.0 PRD",
  "description": "Improving performance and UX"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "status": "pending",
    "message": "PRD generation queued...",
    "prdId": "prd_uuid"
  }
}
```

## WebSocket Connection

### Connect
```javascript
const token = 'your_jwt_token';
const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

// Subscribe to project updates
ws.send(JSON.stringify({
  type: 'subscribe',
  projectId: 'project_uuid'
}));
```

### Event Examples

**Subscription confirmed:**
```json
{
  "type": "subscribed",
  "projectId": "project_uuid",
  "message": "Successfully subscribed to project updates"
}
```

**Note updated:**
```json
{
  "type": "note_updated",
  "projectId": "project_uuid",
  "data": {
    "noteId": "note_uuid",
    "note": { /* full note object */ }
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

**Insight generated:**
```json
{
  "type": "insight_generated",
  "projectId": "project_uuid",
  "data": { /* insight object */ },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## Error Responses

### Validation Error (400)
```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email address"
    }
  ]
}
```

### Authentication Error (401)
```json
{
  "ok": false,
  "code": "AUTH_ERROR",
  "message": "Invalid or expired token"
}
```

### Not Found (404)
```json
{
  "ok": false,
  "code": "NOT_FOUND",
  "message": "Project not found"
}
```

### Access Denied (403)
```json
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "You do not have access to this resource"
}
```

### Conflict (409)
```json
{
  "ok": false,
  "code": "CONFLICT",
  "message": "User with this email already exists"
}
```

## Rate Limiting

Currently not implemented. Consider adding:
- 100 requests/minute per IP
- 1000 requests/day per user
- WebSocket message throttling

## Pagination

Currently all list endpoints return all records. Consider adding:
```
GET /notes/:projectId?page=1&limit=20
GET /insights/:projectId?page=1&limit=50
```
