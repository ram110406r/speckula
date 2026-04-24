# BuildCase Backend

Scalable backend services for the Product Intelligence Workspace supporting thinking, decision-making, and execution workflows.

## Tech Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT-based
- **Realtime**: WebSockets
- **Language**: TypeScript

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy environment file:
```bash
cp .env.example .env
```

2. Update `.env` with your values:
```
DATABASE_URL="postgresql://user:password@localhost:5432/buildcase"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Development

```bash
npm run dev
```

Server will start on http://localhost:3001

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout user

### Workspace & Projects
- `POST /workspace/create` - Create workspace
- `GET /workspace/list` - List user workspaces
- `GET /workspace/:id` - Get workspace details
- `PATCH /workspace/:id` - Update workspace
- `DELETE /workspace/:id` - Delete workspace
- `POST /workspace/:id/project/create` - Create project
- `GET /workspace/:id/projects` - List projects
- `GET /project/:id` - Get project details
- `PATCH /project/:id` - Update project
- `DELETE /project/:id` - Delete project

### Thinking (Notes & Insights)
- `POST /notes/create` - Create note
- `GET /notes/:projectId` - List notes
- `GET /notes/id/:id` - Get note
- `PATCH /notes/:id` - Update note
- `DELETE /notes/:id` - Delete note
- `POST /insights/create` - Create insight
- `GET /insights/:projectId` - List insights
- `GET /insights/note/:noteId` - Get note insights
- `DELETE /insights/:id` - Delete insight
- `PATCH /insights/:id/confidence` - Update confidence score

### Decision Making
- `POST /decision/create` - Create decision
- `GET /decision/:projectId` - List decisions
- `GET /decision/id/:id` - Get decision
- `PATCH /decision/:id` - Update decision
- `DELETE /decision/:id` - Delete decision
- `POST /tradeoff/create` - Create tradeoff
- `GET /tradeoff/:decisionId` - List tradeoffs
- `PATCH /tradeoff/:id` - Update tradeoff
- `DELETE /tradeoff/:id` - Delete tradeoff
- `POST /decision/:id/outcome` - Create/update outcome
- `GET /decision/:id/outcome` - Get outcome

### Build (PRDs & Tasks)
- `POST /prd/create` - Create PRD
- `GET /prd/:projectId` - List PRDs
- `GET /prd/id/:id` - Get PRD
- `PATCH /prd/:id` - Update PRD
- `DELETE /prd/:id` - Delete PRD
- `POST /task/create` - Create task
- `GET /task/project/:projectId` - List tasks
- `GET /task/id/:id` - Get task
- `PATCH /task/:id` - Update task
- `DELETE /task/:id` - Delete task
- `GET /task/:projectId/status/:status` - Filter by status
- `GET /task/:id/dependencies` - Get dependencies

### AI Engine
- `POST /ai/insights/generate` - Trigger insight generation
- `POST /ai/prd/generate` - Trigger PRD generation
- `POST /ai/tasks/suggest` - Get task suggestions
- `POST /ai/analyze/patterns` - Analyze text patterns

## WebSocket Events

Connect to `/ws?token=<jwt_token>` for realtime updates:

### Client Messages
- `subscribe` - Subscribe to project updates
- `unsubscribe` - Unsubscribe from project

### Server Events
- `subscribed` - Subscription confirmed
- `note_updated` - Note was updated
- `insight_generated` - New insight created
- `decision_updated` - Decision was updated
- `task_updated` - Task was updated
- `prd_generated` - PRD was generated
- `error` - An error occurred

## Database Schema

### Core Models
- **User** - User accounts
- **Workspace** - Workspaces owned by users
- **WorkspaceMember** - Workspace access control
- **Project** - Projects within workspaces

### Thinking
- **Note** - Notes and ideas
- **Insight** - AI-generated insights from notes

### Decision Making
- **Decision** - Product decisions
- **Tradeoff** - Decision trade-off analysis
- **DecisionOutcome** - Expected vs actual outcomes

### Building
- **PRD** - Product Requirements Documents
- **Task** - Project tasks with dependencies

### System
- **Integration** - External service integrations
- **RefreshToken** - JWT refresh tokens

## Error Handling

All errors follow this format:

```json
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

Common error codes:
- `VALIDATION_ERROR` - Input validation failed
- `AUTH_ERROR` - Authentication failed
- `NOT_FOUND` - Resource not found
- `FORBIDDEN` - Access denied
- `CONFLICT` - Resource already exists
- `INTERNAL_SERVER_ERROR` - Server error

## Testing

```bash
npm test
```

## Deployment

### Build
```bash
npm run build
```

### Start
```bash
npm start
```

### Environment Variables for Production
- Change `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Set `NODE_ENV=production`
- Configure database with production credentials
- Set appropriate `FRONTEND_URL` for CORS

## Architecture

```
src/
├── index.ts              # Entry point
├── app.ts                # Express app setup
├── lib/                  # Utilities
│   ├── auth.ts          # JWT & password utilities
│   ├── db.ts            # Prisma client
│   ├── errors.ts        # Error handling
│   ├── middleware.ts    # Express middleware
│   ├── realtime.ts      # WebSocket server
│   └── schemas.ts       # Zod validation schemas
├── routes/              # API route handlers
│   ├── authRoutes.ts
│   ├── workspaceRoutes.ts
│   ├── thinkingRoutes.ts
│   ├── decisionRoutes.ts
│   ├── buildRoutes.ts
│   └── aiRoutes.ts
└── services/            # Business logic
    ├── authService.ts
    ├── workspaceService.ts
    ├── thinkingService.ts
    ├── decisionService.ts
    ├── buildService.ts
    └── aiEngineService.ts
```

## Key Design Patterns

1. **Service Layer**: Business logic separated from routes
2. **Error Handling**: Consistent error responses with specific codes
3. **Authorization**: Verified at service layer, enforced consistently
4. **Validation**: Zod schemas at route entry points
5. **Async/Await**: All database operations with proper error handling
6. **Realtime**: WebSocket pub/sub for project-level updates
7. **Data Normalization**: Proper foreign key relationships with CASCADE deletes

## Next Steps

1. **AI Integration**: Connect to Groq, OpenAI, or other LLM provider
2. **Background Jobs**: Implement task queues for long-running operations
3. **Caching**: Add Redis for session/data caching
4. **Monitoring**: Setup logging and metrics with tools like Winston, DataDog
5. **Testing**: Add unit and integration tests with Jest
6. **Rate Limiting**: Add rate limiting middleware
7. **File Storage**: Integrate S3 or similar for document storage
8. **Webhooks**: Support external integrations (Slack, GitHub, etc.)

## Contributing

Follow the existing patterns when adding new features:
- Create service methods in `services/`
- Add validation schemas in `lib/schemas.ts`
- Define routes in `routes/`
- Use consistent error handling
- Document API endpoints in this README

## License

MIT
