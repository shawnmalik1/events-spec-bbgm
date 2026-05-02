import type { BBGMEvent, BBGMGame, BBGMPlayerMinimal, BBGMTeamMinimal, EventCategory, ScoreParseResult } from "./types.js";
/**
 * Strips HTML tags from BBGM event text and extracts readable plain text.
 * Replaces anchor tags with their inner text content.
 */
export declare function stripHtmlToText(html: string): string;
/**
 * Determines the category of an event based on its score, type, and text content.
 * Uses the priority order specified in the spec.
 */
export declare function categorizeEvent(event: BBGMEvent): EventCategory;
/**
 * Resolves a player ID to their full name.
 */
export declare function resolvePlayerName(pid: number, players: BBGMPlayerMinimal[]): string | null;
/**
 * Resolves a team ID to their full name (region + name).
 */
export declare function resolveTeamFullName(tid: number, teams: BBGMTeamMinimal[]): string | null;
/**
 * Gets team info by ID.
 */
export declare function getTeamById(tid: number, teams: BBGMTeamMinimal[]): BBGMTeamMinimal | null;
/**
 * Generates fallback text for events that have no text field or empty text.
 * Uses event type and resolved player/team names.
 */
export declare function generateFallbackText(event: BBGMEvent, players: BBGMPlayerMinimal[], teams: BBGMTeamMinimal[]): string;
/**
 * Parses the score from game highlight event text.
 * Returns the winner and loser points based on the win/loss indicator.
 *
 * Examples:
 * - "112-98 win" -> { winnerPts: 112, loserPts: 98 }
 * - "98-112 loss" -> { winnerPts: 112, loserPts: 98 }
 */
export declare function parseScoreFromText(text: string): ScoreParseResult | null;
/**
 * Finds a matching game for a game highlight event.
 * Matches based on season, team IDs, and exact score.
 */
export declare function findMatchingGame(event: BBGMEvent, games: BBGMGame[], currentSeason: number): BBGMGame | null;
//# sourceMappingURL=utils.d.ts.map