/**
 * Test script for parsing a BBGM league export.
 *
 * Usage: node dist/scripts/test-export.js [path-to-export.json]
 *
 * If no path provided, uses "BBGM EXPORT.json" in project root.
 */
import { readFileSync } from "fs";
import { parseLeagueEvents } from "../src/index.js";
const filePath = process.argv[2] || "BBGM EXPORT.json";
const raw = JSON.parse(readFileSync(filePath, "utf-8"));
// Extract current season from gameAttributes
const gameAttributes = raw.gameAttributes;
let currentSeason;
if (Array.isArray(gameAttributes)) {
    const seasonAttr = gameAttributes.find((attr) => attr.key === "season");
    currentSeason = seasonAttr?.value;
}
else {
    currentSeason = gameAttributes?.season;
}
if (!currentSeason) {
    console.error("Could not determine current season from gameAttributes");
    process.exit(1);
}
console.log(`Parsing events for season ${currentSeason}...\n`);
const result = await parseLeagueEvents({
    events: raw.events ?? [],
    games: raw.games ?? [],
    players: raw.players ?? [],
    teams: raw.teams ?? [],
    currentSeason,
});
console.log(`Found ${result.parsedEvents.length} events for current season`);
console.log(`Found ${result.importantGames.length} important games\n`);
// Group by category
const byCategory = result.parsedEvents.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
}, {});
console.log("Events by category:");
for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${count}`);
}
// Show sample events
console.log("\n--- Sample Events (first 10) ---\n");
for (const event of result.parsedEvents.slice(0, 10)) {
    console.log(`[${event.category}] ${event.text}`);
}
// Show important games
if (result.importantGames.length > 0) {
    console.log("\n--- Important Games (first 5) ---\n");
    for (const game of result.importantGames.slice(0, 5)) {
        const playoff = game.playoffs ? " (Playoffs)" : "";
        console.log(`${game.winner.abbrev} ${game.winner.pts} - ${game.loser.pts} ${game.loser.abbrev}${playoff}`);
        console.log(`  Highlights: ${game.triggeringEvents.length} events`);
    }
}
