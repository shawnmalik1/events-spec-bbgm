import { load } from "cheerio";
// =============================================================================
// Constants
// =============================================================================
const TRANSACTION_TYPES = new Set([
    "trade",
    "freeAgent",
    "reSigned",
    "release",
    "draft",
]);
const PLAYER_LIFECYCLE_TYPES = new Set([
    "retired",
    "injured",
    "healed",
    "tragicDeath",
]);
const SCORE_REGEX = /(\d+)-(\d+)\s+(win|loss)/i;
// =============================================================================
// HTML Text Stripping
// =============================================================================
/**
 * Strips HTML tags from BBGM event text and extracts readable plain text.
 * Replaces anchor tags with their inner text content.
 */
export function stripHtmlToText(html) {
    const $ = load(html);
    $("a").replaceWith((_, el) => $(el).text());
    return $.text().trim();
}
// =============================================================================
// Event Categorization
// =============================================================================
/**
 * Determines the category of an event based on its score, type, and text content.
 * Uses the priority order specified in the spec.
 */
export function categorizeEvent(event) {
    const { score, type, text } = event;
    // Priority 1: Low priority events (score < 8)
    if (score < 8) {
        return "low_priority";
    }
    // Priority 2: Game highlights (score 8-19 with "had" in text)
    if (score >= 8 && score < 20 && text?.includes("had")) {
        return "game_highlight";
    }
    // Priority 3: Transaction events
    if (TRANSACTION_TYPES.has(type)) {
        return "transaction";
    }
    // Priority 4: Player lifecycle events
    if (PLAYER_LIFECYCLE_TYPES.has(type)) {
        return "player_lifecycle";
    }
    // Priority 5: Everything else is a league milestone
    return "league_milestone";
}
// =============================================================================
// Name Resolution
// =============================================================================
/**
 * Resolves a player ID to their full name.
 */
export function resolvePlayerName(pid, players) {
    const player = players.find((p) => p.pid === pid);
    if (!player)
        return null;
    return `${player.firstName} ${player.lastName}`;
}
/**
 * Resolves a team ID to their full name (region + name).
 */
export function resolveTeamFullName(tid, teams) {
    const team = teams.find((t) => t.tid === tid);
    if (!team)
        return null;
    return `${team.region} ${team.name}`;
}
/**
 * Gets team info by ID.
 */
export function getTeamById(tid, teams) {
    return teams.find((t) => t.tid === tid) ?? null;
}
// =============================================================================
// Fallback Text Generation
// =============================================================================
/**
 * Generates fallback text for events that have no text field or empty text.
 * Uses event type and resolved player/team names.
 */
export function generateFallbackText(event, players, teams) {
    const { type, pids, tids } = event;
    const playerName = pids?.[0] !== undefined ? resolvePlayerName(pids[0], players) : null;
    const teamName = tids?.[0] !== undefined ? resolveTeamFullName(tids[0], teams) : null;
    const team2Name = tids?.[1] !== undefined ? resolveTeamFullName(tids[1], teams) : null;
    switch (type) {
        case "freeAgent":
            if (playerName && teamName) {
                return `${playerName} signed with the ${teamName}.`;
            }
            if (playerName) {
                return `${playerName} signed as a free agent.`;
            }
            return "A free agent signing occurred.";
        case "reSigned":
            if (playerName && teamName) {
                return `${playerName} re-signed with the ${teamName}.`;
            }
            if (playerName) {
                return `${playerName} re-signed with their team.`;
            }
            return "A player re-signed with their team.";
        case "release":
            if (teamName && playerName) {
                return `The ${teamName} released ${playerName}.`;
            }
            if (playerName) {
                return `${playerName} was released.`;
            }
            return "A player was released.";
        case "trade":
            if (teamName && team2Name) {
                return `A trade was completed involving the ${teamName} and ${team2Name}.`;
            }
            if (teamName) {
                return `The ${teamName} completed a trade.`;
            }
            return "A trade was completed.";
        case "draft":
            if (playerName && teamName) {
                return `${playerName} was drafted by the ${teamName}.`;
            }
            if (playerName) {
                return `${playerName} was drafted.`;
            }
            return "A player was drafted.";
        case "retired":
            if (playerName) {
                return `${playerName} retired.`;
            }
            return "A player retired.";
        case "injured":
            if (playerName) {
                return `${playerName} was injured.`;
            }
            return "A player was injured.";
        case "healed":
            if (playerName) {
                return `${playerName} returned from injury.`;
            }
            return "A player returned from injury.";
        case "tragicDeath":
            if (playerName) {
                return `${playerName} passed away.`;
            }
            return "A tragic death occurred.";
        default:
            // Generic fallback for other event types
            if (playerName && teamName) {
                return `${type}: ${playerName} (${teamName}).`;
            }
            if (playerName) {
                return `${type}: ${playerName}.`;
            }
            if (teamName) {
                return `${type}: ${teamName}.`;
            }
            return `Event: ${type}.`;
    }
}
// =============================================================================
// Score Parsing
// =============================================================================
/**
 * Parses the score from game highlight event text.
 * Returns the winner and loser points based on the win/loss indicator.
 *
 * Examples:
 * - "112-98 win" -> { winnerPts: 112, loserPts: 98 }
 * - "98-112 loss" -> { winnerPts: 112, loserPts: 98 }
 */
export function parseScoreFromText(text) {
    const match = text.match(SCORE_REGEX);
    if (!match)
        return null;
    const [, scoreA, scoreB, outcome] = match;
    const ptsA = parseInt(scoreA, 10);
    const ptsB = parseInt(scoreB, 10);
    if (outcome.toLowerCase() === "win") {
        // Subject team won: first score is winner's
        return { winnerPts: ptsA, loserPts: ptsB };
    }
    else {
        // Subject team lost: first score is loser's (lower), second is winner's
        return { winnerPts: ptsB, loserPts: ptsA };
    }
}
// =============================================================================
// Game Matching
// =============================================================================
/**
 * Finds a matching game for a game highlight event.
 * Matches based on season, team IDs, and exact score.
 */
export function findMatchingGame(event, games, currentSeason) {
    const { text, tids } = event;
    if (!text || tids.length < 1) {
        return null;
    }
    const scoreResult = parseScoreFromText(text);
    if (!scoreResult) {
        return null;
    }
    const { winnerPts, loserPts } = scoreResult;
    // Find a game matching season, teams, and scores
    for (const game of games) {
        if (game.season !== currentSeason)
            continue;
        // Check if both team IDs from the event are involved in this game
        const gameTeamIds = [game.won.tid, game.lost.tid];
        const eventTeamsInGame = tids.filter((tid) => gameTeamIds.includes(tid));
        // At least one team from the event must be in the game
        // (sometimes events only have one team ID - the subject team)
        if (eventTeamsInGame.length === 0)
            continue;
        // Check if scores match
        if (game.won.pts === winnerPts && game.lost.pts === loserPts) {
            return game;
        }
    }
    return null;
}
