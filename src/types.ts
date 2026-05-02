// =============================================================================
// BBGM Raw Data Types (input - treat as immutable)
// =============================================================================

export interface BBGMEvent {
  eid: number;
  type: string;
  text?: string;
  tids: number[];
  pids?: number[];
  teams?: unknown[];
  score: number;
  season: number;
}

export interface BBGMGame {
  gid: number;
  day: number;
  season: number;
  playoffs: boolean;
  overtimes: number;
  att: number;
  won: { tid: number; pts: number };
  lost: { tid: number; pts: number };
  teams: unknown[];
}

export interface BBGMPlayerMinimal {
  pid: number;
  firstName: string;
  lastName: string;
  tid: number;
}

export interface BBGMTeamMinimal {
  tid: number;
  abbrev: string;
  name: string;
  region: string;
}

// =============================================================================
// Parser Configuration
// =============================================================================

export interface EventParserConfig {
  /**
   * Minimum score for a game-highlight event to be flagged as important.
   * Defaults to 10. Must be within the game-highlight range (8-19).
   */
  importantGameScoreThreshold?: number;

  /**
   * Whether to include low-score (< 8) events in the output.
   * Defaults to false.
   */
  includeLowPriorityEvents?: boolean;
}

// =============================================================================
// Parser Input/Output
// =============================================================================

export interface EventParserInput {
  /** The full events array from the BBGM league export */
  events: BBGMEvent[];

  /** The full games array from the BBGM league export */
  games: BBGMGame[];

  /** Player list for resolving pids to names */
  players: BBGMPlayerMinimal[];

  /** Team list for resolving tids to names/abbreviations */
  teams: BBGMTeamMinimal[];

  /**
   * The current season year, taken from gameAttributes.season.
   * This scopes all parsing to the active season only.
   * Must be explicitly passed - do not infer it from events.
   */
  currentSeason: number;

  /** Optional tuning for importance thresholds */
  config?: EventParserConfig;
}

export interface EventParserOutput {
  /** All events for the current season, parsed into human-readable form and categorized */
  parsedEvents: ParsedEvent[];

  /**
   * Games that had at least one high-importance highlight event associated with them.
   * These are intended for downstream posting (e.g. Discord announcements).
   * Deduped by gid - one entry per game regardless of how many events reference it.
   */
  importantGames: ImportantGame[];
}

// =============================================================================
// Core Output Types
// =============================================================================

export type EventCategory =
  | "transaction"
  | "player_lifecycle"
  | "league_milestone"
  | "game_highlight"
  | "low_priority";

export interface ParsedEvent {
  /** Original event ID from BBGM */
  eid: number;

  /** The BBGM type string (e.g. "freeAgent", "trade") */
  type: string;

  /** Derived category for routing/filtering */
  category: EventCategory;

  /** BBGM importance score - preserved from source */
  score: number;

  /** Season this event belongs to */
  season: number;

  /** Plain text version of the event - HTML stripped, names resolved */
  text: string;

  /** Player IDs involved */
  pids: number[];

  /** Team IDs involved */
  tids: number[];

  /**
   * For game_highlight events only: the gid of the associated game,
   * if it could be resolved. Null if the game could not be matched.
   */
  associatedGameId: number | null;
}

export interface ImportantGame {
  /** BBGM game ID */
  gid: number;

  /** Season year */
  season: number;

  /** Whether this was a playoff game */
  playoffs: boolean;

  /** Winning team */
  winner: {
    tid: number;
    abbrev: string;
    name: string;
    pts: number;
  };

  /** Losing team */
  loser: {
    tid: number;
    abbrev: string;
    name: string;
    pts: number;
  };

  /** The parsed highlight events that caused this game to be flagged */
  triggeringEvents: ParsedEvent[];
}

// =============================================================================
// Internal Types
// =============================================================================

export interface ScoreParseResult {
  winnerPts: number;
  loserPts: number;
}
