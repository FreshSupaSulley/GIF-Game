import type { SelectedGif, Player } from '@gif-game/shared';

const CPU_NAMES = [
  'RoboGuesser',
  'GifBot3000', 
  'PixelPal',
  'MemeBot',
  'ByteBuddy',
  'CyberGuesser',
  'DigiDude',
];

const CPU_AVATARS = [
  'https://cdn.discordapp.com/embed/avatars/0.png',
  'https://cdn.discordapp.com/embed/avatars/1.png',
  'https://cdn.discordapp.com/embed/avatars/2.png',
  'https://cdn.discordapp.com/embed/avatars/3.png',
  'https://cdn.discordapp.com/embed/avatars/4.png',
];

// Funny/random title guesses CPUs might make
const CPU_TITLE_GUESSES = [
  'funny cat',
  'dancing dog',
  'happy dance',
  'reaction face',
  'mind blown',
  'confused person',
  'laughing hard',
  'awkward moment',
  'celebration time',
  'epic fail',
  'surprise reaction',
  'thinking emoji',
  'sad moment',
  'excited jumping',
  'cool sunglasses',
  'thumbs up',
  'facepalm',
  'mic drop',
  'walking away',
  'dramatic look',
];

export interface CpuPlayer {
  id: string;
  username: string;
  avatar: string;
  isCpu: true;
}

/**
 * Service for managing CPU players in dev mode.
 * CPUs auto-select GIFs and make random guesses.
 */
export class CpuPlayerService {
  private cpuPlayers: Map<string, CpuPlayer> = new Map();
  private getRandomGifs: (count: number) => Promise<SelectedGif[]>;
  private cpuCount = 0;

  constructor(getRandomGifs: (count: number) => Promise<SelectedGif[]>) {
    this.getRandomGifs = getRandomGifs;
  }

  /**
   * Create a new CPU player.
   */
  createCpuPlayer(): CpuPlayer {
    const index = this.cpuCount++;
    const id = `cpu-${Date.now()}-${index}`;
    const cpu: CpuPlayer = {
      id,
      username: CPU_NAMES[index % CPU_NAMES.length],
      avatar: CPU_AVATARS[index % CPU_AVATARS.length],
      isCpu: true,
    };
    this.cpuPlayers.set(id, cpu);
    return cpu;
  }

  /**
   * Get a CPU player by ID.
   */
  getCpu(id: string): CpuPlayer | undefined {
    return this.cpuPlayers.get(id);
  }

  /**
   * Check if a player ID belongs to a CPU.
   */
  isCpu(playerId: string): boolean {
    return this.cpuPlayers.has(playerId);
  }

  /**
   * Get all CPU player IDs.
   */
  getCpuIds(): string[] {
    return Array.from(this.cpuPlayers.keys());
  }

  /**
   * CPU selects random GIFs for submission phase.
   * @param count - Number of GIFs to select
   * @returns Array of selected GIFs
   */
  async selectRandomGifs(count: number): Promise<SelectedGif[]> {
    return this.getRandomGifs(count);
  }

  /**
   * CPU picks a random player as submitter guess.
   * @param eligiblePlayerIds - Players that can be guessed (excludes self)
   * @returns Random player ID
   */
  guessRandomSubmitter(eligiblePlayerIds: string[]): string {
    if (eligiblePlayerIds.length === 0) {
      throw new Error('No eligible players to guess');
    }
    const index = Math.floor(Math.random() * eligiblePlayerIds.length);
    return eligiblePlayerIds[index];
  }

  /**
   * CPU generates a random title guess.
   * @returns Random title guess
   */
  guessRandomTitle(): string {
    const index = Math.floor(Math.random() * CPU_TITLE_GUESSES.length);
    return CPU_TITLE_GUESSES[index];
  }

  /**
   * Get a delay for CPU actions (makes it feel more natural).
   * @returns Random delay in ms (500-2000)
   */
  getActionDelay(): number {
    return 500 + Math.floor(Math.random() * 1500);
  }

  /**
   * Clear all CPU players (for room reset).
   */
  clear(): void {
    this.cpuPlayers.clear();
    this.cpuCount = 0;
  }
}

/**
 * Check if CPU players are enabled via environment variable.
 */
export function isCpuPlayersEnabled(): boolean {
  const enabled = process.env['CPU_PLAYERS'] === 'true';
  console.log(`[CpuPlayerService] CPU_PLAYERS env = "${process.env['CPU_PLAYERS']}", enabled = ${enabled}`);
  return enabled;
}
