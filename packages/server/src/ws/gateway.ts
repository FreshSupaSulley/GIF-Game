import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { ClientMessage, ServerMessage } from '@gif-game/shared';
import type { RoomManager } from './room-manager.js';
import type { DiscordUser } from '../auth/discord-auth.js';

export interface ClientConnection {
  ws: WebSocket;
  playerId: string;
  user: DiscordUser;
  roomId: string;
  isAlive: boolean;
}

export interface GatewayOptions {
  server: HttpServer;
  roomManager: RoomManager;
  authenticateToken: (token: string) => Promise<DiscordUser | null>;
}

/**
 * WebSocket gateway managing client connections, message routing, and room broadcasts.
 */
export class Gateway {
  private wss: WebSocketServer;
  private connections: Map<string, ClientConnection> = new Map();
  private roomManager: RoomManager;
  private authenticateToken: (token: string) => Promise<DiscordUser | null>;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: GatewayOptions) {
    this.roomManager = options.roomManager;
    this.authenticateToken = options.authenticateToken;

    this.wss = new WebSocketServer({
      server: options.server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Start heartbeat to detect dead connections
    this.startHeartbeat();
  }

  /**
   * Handle new WebSocket connection.
   * Connection flow: connect -> receive 'join' message -> authenticate -> join room
   */
  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    let connection: ClientConnection | null = null;
    let joinTimeout: ReturnType<typeof setTimeout> | null = null;

    // Set timeout for join message
    joinTimeout = setTimeout(() => {
      if (!connection) {
        this.sendError(ws, 'JOIN_TIMEOUT', 'Must send join message within 10 seconds');
        ws.close(4001, 'Join timeout');
      }
    }, 10000);

    ws.on('message', async (data) => {
      try {
        const message = this.parseMessage(data);
        if (!message) {
          this.sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
          return;
        }

        // If not yet authenticated, only accept join messages
        if (!connection) {
          if (message.type !== 'join') {
            this.sendError(ws, 'NOT_AUTHENTICATED', 'Must send join message first');
            return;
          }

          if (joinTimeout) {
            clearTimeout(joinTimeout);
            joinTimeout = null;
          }

          connection = await this.handleJoin(ws, message);
          if (!connection) {
            ws.close(4002, 'Authentication failed');
          }
          return;
        }

        // Authenticated - route message to room
        this.handleMessage(connection, message);
      } catch (err) {
        console.error('[Gateway] Error handling message:', err);
        this.sendError(ws, 'INTERNAL_ERROR', 'Internal server error');
      }
    });

    ws.on('close', () => {
      if (joinTimeout) {
        clearTimeout(joinTimeout);
      }
      if (connection) {
        this.handleDisconnect(connection);
      }
    });

    ws.on('error', (err) => {
      console.error('[Gateway] WebSocket error:', err);
    });

    ws.on('pong', () => {
      if (connection) {
        connection.isAlive = true;
      }
    });
  }

  /**
   * Handle join message - authenticate and add to room.
   */
  private async handleJoin(
    ws: WebSocket,
    message: ClientMessage & { type: 'join' }
  ): Promise<ClientConnection | null> {
    const { token, instanceId } = message;

    // Authenticate token
    const user = await this.authenticateToken(token);
    if (!user) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid or expired token');
      return null;
    }

    // Check for existing connection (reconnection case)
    const existingConnection = this.connections.get(user.id);
    if (existingConnection) {
      // Close old connection, use new one
      existingConnection.ws.close(4003, 'Reconnected from another session');
      this.connections.delete(user.id);
    }

    // Create connection object
    const connection: ClientConnection = {
      ws,
      playerId: user.id,
      user,
      roomId: instanceId,
      isAlive: true,
    };

    this.connections.set(user.id, connection);

    // Join or reconnect to room
    const result = this.roomManager.joinRoom(instanceId, user, {
      broadcast: (msg) => this.broadcastToRoom(instanceId, msg),
      sendTo: (playerId, msg) => this.sendToPlayer(playerId, msg),
    });

    if (!result.ok) {
      this.connections.delete(user.id);
      this.sendError(ws, result.code, result.message);
      return null;
    }

    // Send full state to the new player
    this.send(ws, {
      type: 'state:full',
      state: result.state,
    });

    console.log(`[Gateway] Player ${user.username} (${user.id}) joined room ${instanceId}`);
    return connection;
  }

  /**
   * Route authenticated message to room handler.
   */
  private handleMessage(connection: ClientConnection, message: ClientMessage): void {
    const { roomId, playerId } = connection;

    // Handle search separately (doesn't go through game room)
    if (message.type === 'gif:search') {
      this.roomManager.handleSearch(roomId, playerId, message.query);
      return;
    }

    // All other messages go to the game room
    this.roomManager.handleAction(roomId, playerId, message);
  }

  /**
   * Handle player disconnect.
   */
  private handleDisconnect(connection: ClientConnection): void {
    const { playerId, roomId, user } = connection;
    this.connections.delete(playerId);
    this.roomManager.handleDisconnect(roomId, playerId);
    console.log(`[Gateway] Player ${user.username} (${playerId}) disconnected from room ${roomId}`);
  }

  /**
   * Send message to a specific player.
   */
  sendToPlayer(playerId: string, message: ServerMessage): void {
    const connection = this.connections.get(playerId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      this.send(connection.ws, message);
    }
  }

  /**
   * Broadcast message to all players in a room.
   */
  broadcastToRoom(roomId: string, message: ServerMessage): void {
    const json = JSON.stringify(message);
    let sentCount = 0;
    const connectionInfo: string[] = [];
    for (const [playerId, connection] of this.connections.entries()) {
      const matches = connection.roomId === roomId;
      const isOpen = connection.ws.readyState === WebSocket.OPEN;
      connectionInfo.push(`${playerId.slice(0,8)}... room=${connection.roomId.slice(0,20)}... matches=${matches} open=${isOpen}`);
      if (matches && isOpen) {
        connection.ws.send(json);
        sentCount++;
      }
    }
    console.log(`[Gateway] Broadcast ${message.type} to ${sentCount}/${this.connections.size} clients`);
    if (sentCount === 0 && this.connections.size > 0) {
      console.log(`[Gateway] Connection details:`, connectionInfo);
      console.log(`[Gateway] Target roomId: ${roomId.slice(0, 30)}...`);
    }
  }

  /**
   * Send message to a WebSocket.
   */
  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to a WebSocket.
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }

  /**
   * Parse incoming WebSocket message.
   */
  private parseMessage(data: unknown): ClientMessage | null {
    try {
      const text = data instanceof Buffer ? data.toString('utf-8') : String(data);
      const parsed = JSON.parse(text);
      
      // Basic validation - must have a type field
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
        return null;
      }

      return parsed as ClientMessage;
    } catch {
      return null;
    }
  }

  /**
   * Start heartbeat interval to detect dead connections.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (!connection.isAlive) {
          connection.ws.terminate();
          continue;
        }
        connection.isAlive = false;
        connection.ws.ping();
      }
    }, 30000);
  }

  /**
   * Graceful shutdown.
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();

    this.wss.close();
  }
}
