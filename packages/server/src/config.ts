export interface Config {
  /** Discord OAuth2 application client ID (required) */
  discordClientId: string;
  /** Discord OAuth2 application client secret (required) */
  discordClientSecret: string;
  /** Port the Express server listens on (default: 3001) */
  port: number;
}

/**
 * Parses and validates required environment variables.
 * Throws if any required variable is missing.
 */
export function loadConfig(): Config {
  const discordClientId = process.env.DISCORD_CLIENT_ID;
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
  const port = parseInt(process.env.PORT ?? '3001', 10);

  const missing: string[] = [];
  if (!discordClientId) missing.push('DISCORD_CLIENT_ID');
  if (!discordClientSecret) missing.push('DISCORD_CLIENT_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a valid number between 1 and 65535`);
  }

  return {
    discordClientId: discordClientId!,
    discordClientSecret: discordClientSecret!,
    port,
  };
}
