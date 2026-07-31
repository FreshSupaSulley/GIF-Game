import { createServer } from 'http';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { Gateway } from './ws/gateway.js';
import { RoomManager } from './ws/room-manager.js';
import { createDiscordAuth } from './auth/discord-auth.js';
import { createKlipyService } from './services/klipy-service.js';

const config = loadConfig();
const app = createApp(config);

// Create HTTP server (needed for WebSocket upgrade)
const server = createServer(app);

// Initialize services
const discordAuth = createDiscordAuth(config);
const klipyService = createKlipyService();

// Initialize room manager
const roomManager = new RoomManager({
  klipyService,
});

// Initialize WebSocket gateway
const gateway = new Gateway({
  server,
  roomManager,
  authenticateToken: (token) => discordAuth.validateToken(token),
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  
  gateway.close();
  roomManager.close();
  discordAuth.clearCache();
  
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
server.listen(config.port, () => {
  console.log(`[Server] HTTP server listening on http://localhost:${config.port}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${config.port}/ws`);
  console.log(`[Server] KLIPY dev mode: ${process.env['KLIPY_DEV_MODE'] === 'true' || !process.env['KLIPY_API_KEY']}`);
  console.log(`[Server] CPU players: ${process.env['CPU_PLAYERS'] === 'true'}`);
});
