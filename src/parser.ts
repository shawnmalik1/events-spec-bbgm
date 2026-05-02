import type {
  BBGMEvent,
  BBGMGame,
  BBGMPlayerMinimal,
  BBGMTeamMinimal,
  EventParserConfig,
  EventParserInput,
  EventParserOutput,
  ImportantGame,
  ParsedEvent,
} from "./types.js";
import {
  categorizeEvent,
  findMatchingGame,
  generateFallbackText,
  getTeamById,
  stripHtmlToText,
} from "./utils.js";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<EventParserConfig> = {
  importantGameScoreThreshold: 10,
  includeLowPriorityEvents: false,
};

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Top-level function. Accepts raw BBGM league data and returns structured,
 * human-readable events and important games for the current season.
 *
 * Processing Pipeline:
 * 1. Filter to current season
 * 2. Categorize by score + type
 * 3. Parse text (strip HTML, build fallbacks)
 * 4. Match game highlights to games
 * 5. Assemble output
 */
export async function parseLeagueEvents(
  input: EventParserInput
): Promise<EventParserOutput> {
  const { events, games, players, teams, currentSeason, config } = input;

  const mergedConfig: Required<EventParserConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Stage 1: Filter to current season
  const seasonEvents = filterToCurrentSeason(events, currentSeason);

  // Stage 2-4: Process each event
  const parsedEvents: ParsedEvent[] = [];
  const importantGameMap = new Map<number, ImportantGame>();

  for (const event of seasonEvents) {
    // Stage 2: Categorize
    const category = categorizeEvent(event);

    // Skip low priority events unless configured to include them
    if (category === "low_priority" && !mergedConfig.includeLowPriorityEvents) {
      continue;
    }

    // Stage 3: Parse text
    const text = parseEventText(event, players, teams);

    // Stage 4: Match to game (for game highlights above threshold)
    let associatedGameId: number | null = null;

    if (
      category === "game_highlight" &&
      event.score >= mergedConfig.importantGameScoreThreshold
    ) {
      const matchedGame = findMatchingGame(event, games, currentSeason);
      if (matchedGame) {
        associatedGameId = matchedGame.gid;
      } else {
        // Log warning for unmatched game (in real implementation, this could use a logger)
        console.warn(
          `Could not match game for event ${event.eid}: "${text.substring(0, 50)}..."`
        );
      }
    }

    const parsedEvent: ParsedEvent = {
      eid: event.eid,
      type: event.type,
      category,
      score: event.score,
      season: event.season,
      text,
      pids: event.pids ?? [],
      tids: event.tids,
      associatedGameId,
    };

    parsedEvents.push(parsedEvent);

    // Stage 4 continued: Build important games map
    if (associatedGameId !== null) {
      addToImportantGamesMap(
        importantGameMap,
        associatedGameId,
        parsedEvent,
        games,
        teams,
        currentSeason
      );
    }
  }

  // Stage 5: Assemble output
  const importantGames = Array.from(importantGameMap.values());

  return {
    parsedEvents,
    importantGames,
  };
}

// =============================================================================
// Stage 1: Filter to Current Season
// =============================================================================

function filterToCurrentSeason(
  events: BBGMEvent[],
  currentSeason: number
): BBGMEvent[] {
  return events.filter((event) => event.season === currentSeason);
}

// =============================================================================
// Stage 3: Parse Event Text
// =============================================================================

function parseEventText(
  event: BBGMEvent,
  players: BBGMPlayerMinimal[],
  teams: BBGMTeamMinimal[]
): string {
  if (event.text && event.text.trim()) {
    return stripHtmlToText(event.text);
  }

  // Generate fallback text
  return generateFallbackText(event, players, teams);
}

// =============================================================================
// Stage 4: Build Important Games Map
// =============================================================================

function addToImportantGamesMap(
  map: Map<number, ImportantGame>,
  gid: number,
  parsedEvent: ParsedEvent,
  games: BBGMGame[],
  teams: BBGMTeamMinimal[],
  currentSeason: number
): void {
  // If this game is already in the map, just add the triggering event
  if (map.has(gid)) {
    const existing = map.get(gid)!;
    existing.triggeringEvents.push(parsedEvent);
    return;
  }

  // Find the game data
  const game = games.find(
    (g) => g.gid === gid && g.season === currentSeason
  );
  if (!game) return;

  // Get team info
  const winnerTeam = getTeamById(game.won.tid, teams);
  const loserTeam = getTeamById(game.lost.tid, teams);

  if (!winnerTeam || !loserTeam) return;

  const importantGame: ImportantGame = {
    gid,
    season: game.season,
    playoffs: game.playoffs,
    winner: {
      tid: game.won.tid,
      abbrev: winnerTeam.abbrev,
      name: winnerTeam.name,
      pts: game.won.pts,
    },
    loser: {
      tid: game.lost.tid,
      abbrev: loserTeam.abbrev,
      name: loserTeam.name,
      pts: game.lost.pts,
    },
    triggeringEvents: [parsedEvent],
  };

  map.set(gid, importantGame);
}
