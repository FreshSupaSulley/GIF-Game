import path from 'node:path';
import express from 'express';
import cors from 'cors';
import type { Config } from './config';
import { DISCORD_API_BASE_URL } from '@gif-game/shared';

/**
 * Creates and configures the Express app.
 * Separated from server startup for testability.
 */
export function createApp(config: Config) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // -------------------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------------------

  /**
   * POST /api/token
   * Exchanges a Discord OAuth2 authorization code for an access token.
   * Expects JSON body: { code: string }
   */
  app.post('/api/token', async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "code" in request body' });
      return;
    }

    try {
      const params = new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
      });

      const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        res.status(response.status).json({
          error: 'Discord token exchange failed',
          details: errorBody,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: 'Token exchange request failed', details: message });
    }
  });

  // -------------------------------------------------------------------------
  // Static file serving (built client)
  // -------------------------------------------------------------------------

  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback: all non-API routes serve index.html (Express 5 syntax)
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  return app;
}
