// Main parser function
export { parseLeagueEvents } from "./parser.js";

// All types
export type {
  // BBGM raw data types (input)
  BBGMEvent,
  BBGMGame,
  BBGMPlayerMinimal,
  BBGMTeamMinimal,
  // Parser configuration
  EventParserConfig,
  EventParserInput,
  EventParserOutput,
  // Output types
  EventCategory,
  ImportantGame,
  ParsedEvent,
} from "./types.js";

// Utility functions (exported for testing and advanced usage)
export {
  categorizeEvent,
  findMatchingGame,
  generateFallbackText,
  getTeamById,
  parseScoreFromText,
  resolvePlayerName,
  resolveTeamFullName,
  stripHtmlToText,
} from "./utils.js";
