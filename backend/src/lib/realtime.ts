import { Server, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { verifyAccessToken } from '../lib/auth';
import { db } from '../lib/db';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  projectId?: string;
}

interface RealtimeEvent {
  type: string;
  projectId: string;
  data: any;
  timestamp: Date;
}

/**
 * Realtime WebSocket server
 * Handles live updates for notes, insights, decisions, tasks, etc.
 */
export class RealtimeServer {
  private wss: Server;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new Server({ server, path: '/ws' });
    this.setupConnectionHandler();
  }

  private setupConnectionHandler() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('[WS] Client connected');

      // Authenticate using token from query params
      const token = new URL(req.url || '', 'ws://localhost').searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Unauthorized - no token provided');
        return;
      }

      try {
        const payload = verifyAccessToken(token);
        ws.userId = payload.userId;
      } catch (error) {
        ws.close(4001, 'Unauthorized - invalid token');
        return;
      }

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log('[WS] Client disconnected');
        this.unsubscribeFromProject(ws);
      });

      ws.on('error', (error) => {
        console.error('[WS] Error:', error);
      });
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, data: any) {
    const { type, projectId } = data;

    switch (type) {
      case 'subscribe':
        await this.subscribeToProject(ws, projectId);
        break;
      case 'unsubscribe':
        this.unsubscribeFromProject(ws);
        break;
      default:
        console.log('[WS] Unknown message type:', type);
    }
  }

  private async subscribeToProject(ws: AuthenticatedWebSocket, projectId: string) {
    if (!ws.userId) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Not authenticated',
        })
      );
      return;
    }

    // Verify project access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Project not found',
        })
      );
      return;
    }

    const hasAccess =
      project.workspace.ownerId === ws.userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: project.workspace.id, userId: ws.userId },
      })) !== null;

    if (!hasAccess) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Access denied',
        })
      );
      return;
    }

    // Subscribe to project updates
    ws.projectId = projectId;

    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }

    this.clients.get(projectId)!.add(ws);

    // Send subscription confirmation
    ws.send(
      JSON.stringify({
        type: 'subscribed',
        projectId,
        message: 'Successfully subscribed to project updates',
      })
    );

    console.log(`[WS] Client subscribed to project ${projectId}`);
  }

  private unsubscribeFromProject(ws: AuthenticatedWebSocket) {
    if (!ws.projectId) return;

    const clients = this.clients.get(ws.projectId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.clients.delete(ws.projectId);
      }
    }

    console.log(`[WS] Client unsubscribed from project ${ws.projectId}`);
  }

  /**
   * Broadcast event to all clients subscribed to a project
   */
  public broadcastToProject(projectId: string, event: RealtimeEvent) {
    const clients = this.clients.get(projectId);
    if (!clients) return;

    const message = JSON.stringify(event);

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(
      `[WS] Broadcasted ${event.type} to ${clients.size} clients in project ${projectId}`
    );
  }

  /**
   * Emit note_updated event
   */
  public noteUpdated(projectId: string, noteId: string, note: any) {
    this.broadcastToProject(projectId, {
      type: 'note_updated',
      projectId,
      data: { noteId, note },
      timestamp: new Date(),
    });
  }

  /**
   * Emit insight_generated event
   */
  public insightGenerated(projectId: string, insight: any) {
    this.broadcastToProject(projectId, {
      type: 'insight_generated',
      projectId,
      data: insight,
      timestamp: new Date(),
    });
  }

  /**
   * Emit decision_updated event
   */
  public decisionUpdated(projectId: string, decision: any) {
    this.broadcastToProject(projectId, {
      type: 'decision_updated',
      projectId,
      data: decision,
      timestamp: new Date(),
    });
  }

  /**
   * Emit task_updated event
   */
  public taskUpdated(projectId: string, task: any) {
    this.broadcastToProject(projectId, {
      type: 'task_updated',
      projectId,
      data: task,
      timestamp: new Date(),
    });
  }

  /**
   * Emit prd_generated event
   */
  public prdGenerated(projectId: string, prd: any) {
    this.broadcastToProject(projectId, {
      type: 'prd_generated',
      projectId,
      data: prd,
      timestamp: new Date(),
    });
  }

  /**
   * Cleanup on server shutdown
   */
  public close() {
    this.wss.close(() => {
      console.log('[WS] WebSocket server closed');
    });
  }
}
