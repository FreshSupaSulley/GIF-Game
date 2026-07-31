import type { ServerMessage } from '@gif-game/shared';

export interface TimerOptions {
  /** Duration in milliseconds */
  durationMs: number;
  /** Callback when timer expires */
  onExpiry: () => void;
  /** Callback for each tick (every second) */
  onTick?: (remainingMs: number) => void;
  /** Phase identifier for tick messages */
  phase: string;
}

export interface ActiveTimer {
  id: string;
  phase: string;
  startedAt: number;
  durationMs: number;
  interval: ReturnType<typeof setInterval>;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Manages server-side countdown timers with tick broadcasts.
 * Used for submission phase and guessing phase time limits.
 */
export class TimerService {
  private timers: Map<string, ActiveTimer> = new Map();
  private broadcast: (message: ServerMessage) => void;

  constructor(broadcast: (message: ServerMessage) => void) {
    this.broadcast = broadcast;
  }

  /**
   * Start a new timer with the given options.
   * @param id - Unique identifier for the timer (e.g., 'submission', 'guess-player1')
   * @param options - Timer configuration
   * @returns The timer ID
   */
  start(id: string, options: TimerOptions): string {
    // Cancel any existing timer with this ID
    this.cancel(id);

    const { durationMs, onExpiry, onTick, phase } = options;
    const startedAt = Date.now();

    // Broadcast initial tick
    this.broadcastTick(phase, durationMs);
    onTick?.(durationMs);

    // Set up interval for tick broadcasts (every second)
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, durationMs - elapsed);
      
      this.broadcastTick(phase, remaining);
      onTick?.(remaining);

      // Stop ticking when time is up (expiry will handle via timeout)
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    // Set up timeout for expiry
    const timeout = setTimeout(() => {
      this.handleExpiry(id, onExpiry);
    }, durationMs);

    const timer: ActiveTimer = {
      id,
      phase,
      startedAt,
      durationMs,
      interval,
      timeout,
    };

    this.timers.set(id, timer);
    console.log(`[TimerService] Started timer ${id} for ${durationMs}ms (phase: ${phase})`);

    return id;
  }

  /**
   * Cancel a running timer.
   */
  cancel(id: string): boolean {
    const timer = this.timers.get(id);
    if (!timer) return false;

    clearInterval(timer.interval);
    clearTimeout(timer.timeout);
    this.timers.delete(id);

    console.log(`[TimerService] Cancelled timer ${id}`);
    return true;
  }

  /**
   * Get the remaining time for a timer.
   */
  getRemaining(id: string): number | null {
    const timer = this.timers.get(id);
    if (!timer) return null;

    const elapsed = Date.now() - timer.startedAt;
    return Math.max(0, timer.durationMs - elapsed);
  }

  /**
   * Check if a timer is active.
   */
  isActive(id: string): boolean {
    return this.timers.has(id);
  }

  /**
   * Get timer state for inclusion in game state.
   */
  getTimerState(id: string): { startedAt: number; durationMs: number; remainingMs: number } | null {
    const timer = this.timers.get(id);
    if (!timer) return null;

    const elapsed = Date.now() - timer.startedAt;
    const remainingMs = Math.max(0, timer.durationMs - elapsed);

    return {
      startedAt: timer.startedAt,
      durationMs: timer.durationMs,
      remainingMs,
    };
  }

  /**
   * Handle timer expiry.
   */
  private handleExpiry(id: string, onExpiry: () => void): void {
    const timer = this.timers.get(id);
    if (!timer) return;

    // Clean up interval
    clearInterval(timer.interval);
    this.timers.delete(id);

    console.log(`[TimerService] Timer ${id} expired`);

    // Broadcast final tick with 0
    this.broadcastTick(timer.phase, 0);

    // Call expiry handler
    try {
      onExpiry();
    } catch (err) {
      console.error(`[TimerService] Error in expiry handler for ${id}:`, err);
    }
  }

  /**
   * Broadcast a timer tick message.
   */
  private broadcastTick(phase: string, remainingMs: number): void {
    this.broadcast({
      type: 'timer:tick',
      phase,
      remainingMs,
    });
  }

  /**
   * Cancel all timers (for shutdown or game reset).
   */
  cancelAll(): void {
    for (const id of this.timers.keys()) {
      this.cancel(id);
    }
  }

  /**
   * Update the broadcast function (e.g., when room events change).
   */
  setBroadcast(broadcast: (message: ServerMessage) => void): void {
    this.broadcast = broadcast;
  }
}

/**
 * Factory to create timer IDs.
 */
export const TimerIds = {
  submission: () => 'submission',
  guess: (playerId: string) => `guess-${playerId}`,
} as const;
