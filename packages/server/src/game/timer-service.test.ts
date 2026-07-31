import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerService, TimerIds } from './timer-service';
import type { ServerMessage } from '@gif-game/shared';

describe('TimerService', () => {
  let timerService: TimerService;
  let broadcasts: ServerMessage[];
  let mockBroadcast: (msg: ServerMessage) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcasts = [];
    mockBroadcast = (msg) => broadcasts.push(msg);
    timerService = new TimerService(mockBroadcast);
  });

  afterEach(() => {
    timerService.cancelAll();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should create a timer and broadcast initial tick', () => {
      timerService.start('test', {
        durationMs: 5000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0]).toEqual({
        type: 'timer:tick',
        phase: 'test-phase',
        remainingMs: 5000,
      });
    });

    it('should broadcast ticks every second', () => {
      timerService.start('test', {
        durationMs: 3000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      broadcasts.length = 0; // Clear initial tick

      vi.advanceTimersByTime(1000);
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0]).toMatchObject({ remainingMs: 2000 });

      vi.advanceTimersByTime(1000);
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[1]).toMatchObject({ remainingMs: 1000 });
    });

    it('should call onExpiry when timer expires', () => {
      const onExpiry = vi.fn();
      timerService.start('test', {
        durationMs: 2000,
        phase: 'test-phase',
        onExpiry,
      });

      expect(onExpiry).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(onExpiry).toHaveBeenCalledOnce();
    });

    it('should broadcast final tick with 0 on expiry', () => {
      timerService.start('test', {
        durationMs: 1000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      broadcasts.length = 0;
      vi.advanceTimersByTime(1000);

      const lastBroadcast = broadcasts[broadcasts.length - 1];
      expect(lastBroadcast).toMatchObject({
        type: 'timer:tick',
        remainingMs: 0,
      });
    });

    it('should call onTick callback each second', () => {
      const onTick = vi.fn();
      timerService.start('test', {
        durationMs: 3000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
        onTick,
      });

      expect(onTick).toHaveBeenCalledWith(3000); // Initial

      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(2000);

      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(1000);
    });

    it('should cancel existing timer with same ID', () => {
      const onExpiry1 = vi.fn();
      const onExpiry2 = vi.fn();

      timerService.start('test', {
        durationMs: 5000,
        phase: 'phase1',
        onExpiry: onExpiry1,
      });

      timerService.start('test', {
        durationMs: 2000,
        phase: 'phase2',
        onExpiry: onExpiry2,
      });

      vi.advanceTimersByTime(2000);
      expect(onExpiry1).not.toHaveBeenCalled();
      expect(onExpiry2).toHaveBeenCalledOnce();
    });
  });

  describe('cancel', () => {
    it('should stop the timer', () => {
      const onExpiry = vi.fn();
      timerService.start('test', {
        durationMs: 2000,
        phase: 'test-phase',
        onExpiry,
      });

      timerService.cancel('test');
      vi.advanceTimersByTime(3000);

      expect(onExpiry).not.toHaveBeenCalled();
    });

    it('should return true if timer existed', () => {
      timerService.start('test', {
        durationMs: 1000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      expect(timerService.cancel('test')).toBe(true);
    });

    it('should return false if timer did not exist', () => {
      expect(timerService.cancel('nonexistent')).toBe(false);
    });
  });

  describe('getRemaining', () => {
    it('should return remaining time', () => {
      timerService.start('test', {
        durationMs: 5000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      vi.advanceTimersByTime(2000);
      expect(timerService.getRemaining('test')).toBe(3000);
    });

    it('should return 0 when timer expired', () => {
      timerService.start('test', {
        durationMs: 1000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      vi.advanceTimersByTime(1500);
      expect(timerService.getRemaining('test')).toBeNull(); // Timer cleaned up after expiry
    });

    it('should return null for nonexistent timer', () => {
      expect(timerService.getRemaining('nonexistent')).toBeNull();
    });
  });

  describe('isActive', () => {
    it('should return true for active timer', () => {
      timerService.start('test', {
        durationMs: 5000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      expect(timerService.isActive('test')).toBe(true);
    });

    it('should return false after timer expires', () => {
      timerService.start('test', {
        durationMs: 1000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      vi.advanceTimersByTime(1000);
      expect(timerService.isActive('test')).toBe(false);
    });

    it('should return false for nonexistent timer', () => {
      expect(timerService.isActive('nonexistent')).toBe(false);
    });
  });

  describe('getTimerState', () => {
    it('should return timer state object', () => {
      const now = Date.now();
      timerService.start('test', {
        durationMs: 5000,
        phase: 'test-phase',
        onExpiry: vi.fn(),
      });

      vi.advanceTimersByTime(2000);
      const state = timerService.getTimerState('test');

      expect(state).toMatchObject({
        startedAt: now,
        durationMs: 5000,
        remainingMs: 3000,
      });
    });

    it('should return null for nonexistent timer', () => {
      expect(timerService.getTimerState('nonexistent')).toBeNull();
    });
  });

  describe('cancelAll', () => {
    it('should cancel all active timers', () => {
      const onExpiry1 = vi.fn();
      const onExpiry2 = vi.fn();

      timerService.start('timer1', {
        durationMs: 5000,
        phase: 'phase1',
        onExpiry: onExpiry1,
      });

      timerService.start('timer2', {
        durationMs: 3000,
        phase: 'phase2',
        onExpiry: onExpiry2,
      });

      timerService.cancelAll();
      vi.advanceTimersByTime(10000);

      expect(onExpiry1).not.toHaveBeenCalled();
      expect(onExpiry2).not.toHaveBeenCalled();
    });
  });

  describe('TimerIds', () => {
    it('should generate submission timer ID', () => {
      expect(TimerIds.submission()).toBe('submission');
    });

    it('should generate guess timer ID with player', () => {
      expect(TimerIds.guess('player123')).toBe('guess-player123');
    });
  });
});
