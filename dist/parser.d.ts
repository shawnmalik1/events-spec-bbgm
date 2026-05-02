import type { EventParserInput, EventParserOutput } from "./types.js";
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
export declare function parseLeagueEvents(input: EventParserInput): Promise<EventParserOutput>;
//# sourceMappingURL=parser.d.ts.map