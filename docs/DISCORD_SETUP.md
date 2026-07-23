# Discord Activity Setup Guide

This guide walks through registering the GIF Guessing Game as a Discord Activity and running it locally for development.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Discord Desktop or Web client](https://discord.com/)
- A Discord server where you have admin permissions

## 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it (e.g., "GIF Guessing Game")
3. Navigate to the **OAuth2** tab
4. Copy the **CLIENT ID** and **CLIENT SECRET** -- you will need these for your `.env` file

## 2. Enable Activities

1. In the Developer Portal, select your application
2. Go to the **Activities** tab in the left sidebar
3. Toggle **Enable** to activate the Activity feature
4. Under **URL Mappings**, add a root mapping:
   - **Prefix**: `/`
   - **Target**: your tunnel URL (see step 4), e.g., `https://your-tunnel.trycloudflare.com` or `https://xxxx.ngrok-free.app`

> URL Mappings tell Discord where to load your Activity iframe from. During development, this points to your local tunnel. In production, it points to your deployed domain.

## 3. Configure OAuth2

1. Stay on the **OAuth2** tab in the Developer Portal
2. Under **Redirects**, add your tunnel URL as a redirect URI (Discord handles redirect internally for Activities, but having it configured avoids issues)
3. Under **Scopes**, the Activity only needs:
   - `identify` -- retrieves the user's Discord username and avatar

> The Embedded App SDK handles the OAuth2 flow automatically within the iframe. The server exchanges the authorization code for an access token via the `/api/token` endpoint.

## 4. Local Development Tunnel

Discord requires HTTPS for Activity URL mappings. Use a tunnel to expose your local dev server.

### Option A: Cloudflared (recommended, free, no account needed)

```bash
npx cloudflared tunnel --url http://localhost:5173
```

This prints a URL like `https://random-words.trycloudflare.com`. Use this URL in the Discord Developer Portal URL Mapping (step 2).

### Option B: ngrok

```bash
ngrok http 5173
```

This prints a URL like `https://xxxx.ngrok-free.app`. Use this URL in the Discord Developer Portal URL Mapping (step 2).

### Important Notes

- The tunnel must point to the **Vite dev server** port (`5173`) since the Vite proxy forwards `/api` requests to the Express server on port `3001`
- Every time you restart cloudflared, you get a new URL. Update the Discord Developer Portal URL Mapping accordingly
- ngrok provides a stable URL on paid plans; the free tier rotates URLs on restart

## 5. Environment Setup

1. Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

2. Fill in the values from step 1:

```env
DISCORD_CLIENT_ID=your_actual_client_id
DISCORD_CLIENT_SECRET=your_actual_client_secret
VITE_DISCORD_CLIENT_ID=your_actual_client_id
PORT=3001
```

> `VITE_DISCORD_CLIENT_ID` is the same value as `DISCORD_CLIENT_ID`. The client needs it prefixed with `VITE_` so Vite exposes it to the browser bundle via `import.meta.env`.

## 6. Running Locally

### Terminal 1: Start the Express server

```bash
cd packages/server
npm run dev
```

Or with tsx directly:

```bash
npx tsx src/index.ts
```

The server starts on `http://localhost:3001`.

### Terminal 2: Start the Vite dev server

```bash
cd packages/client
npm run dev
```

The Vite dev server starts on `http://localhost:5173` and proxies `/api` requests to port `3001`.

### Terminal 3: Start the tunnel

```bash
npx cloudflared tunnel --url http://localhost:5173
```

Copy the generated URL and paste it into the Discord Developer Portal URL Mapping if it has changed.

### Alternative: Docker (if docker-compose is configured)

```bash
docker-compose up
```

Then start a tunnel pointing to whichever port Docker exposes (typically `3001` for the combined server).

## 7. Verification

Once all three terminals are running and the URL mapping is configured:

1. Open the **Discord desktop or web client**
2. Join a **voice channel** in your test server (Activities also work in text channels and DMs)
3. Click the **rocket ship icon** (Activities) in the voice channel toolbar
4. Look for your app under **Developer Activities** (it appears here for apps you own)
5. Click to launch the Activity

### Expected Result

- The Discord iframe loads your app from the tunnel URL
- The Embedded App SDK initializes and triggers the OAuth2 flow
- The server exchanges the auth code for an access token at `/api/token`
- The app displays: **"Hello World"** and **"Welcome, {your Discord username}!"**

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Activity does not appear in the rocket menu | Make sure Activities is enabled in the Developer Portal and URL Mapping is set |
| "This site can't be reached" in the iframe | Your tunnel is not running or the URL mapping is stale. Restart the tunnel and update the mapping |
| OAuth error / token exchange fails | Verify `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env` match the Developer Portal values |
| Blank screen after auth | Check the browser console (right-click iframe > Inspect). Look for CORS errors or missing `VITE_DISCORD_CLIENT_ID` |
| "Connecting to Discord..." hangs forever | The SDK `ready()` call may be failing. Make sure you are loading the app inside Discord (not a regular browser tab) |

## Architecture Reference

```
Discord Client (iframe)
    |
    | HTTPS (tunnel)
    v
Vite Dev Server (:5173)
    |
    | proxy /api/*
    v
Express Server (:3001)
    |
    | POST /api/token
    v
Discord API (OAuth2 token exchange)
```

The Vite dev server serves the React SPA and proxies API calls to the Express backend. The tunnel gives Discord a public HTTPS URL to load in its iframe.
