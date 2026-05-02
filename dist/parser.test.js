import { describe, expect, it } from "vitest";
import { categorizeEvent, parseLeagueEvents, parseScoreFromText, stripHtmlToText, } from "./index.js";
// =============================================================================
// Test Data Factories
// =============================================================================
function createPlayer(pid, firstName, lastName, tid = 0) {
    return { pid, firstName, lastName, tid };
}
function createTeam(tid, abbrev, name, region) {
    return { tid, abbrev, name, region };
}
function createEvent(overrides) {
    return {
        eid: 1,
        type: "generic",
        tids: [],
        score: 10,
        season: 2024,
        ...overrides,
    };
}
function createGame(overrides) {
    return {
        gid: 1,
        day: 1,
        season: 2024,
        playoffs: false,
        overtimes: 0,
        att: 15000,
        won: { tid: 0, pts: 100 },
        lost: { tid: 1, pts: 95 },
        teams: [],
        ...overrides,
    };
}
// Default test data
const defaultPlayers = [
    createPlayer(797, "Zach", "Collins", 7),
    createPlayer(204, "Jayson", "Tatum", 0),
    createPlayer(102, "Anthony", "Davis", 5),
    createPlayer(77, "Jaylen", "Brown", 1),
];
const defaultTeams = [
    createTeam(0, "BOS", "Celtics", "Boston"),
    createTeam(1, "MIA", "Heat", "Miami"),
    createTeam(5, "LAL", "Lakers", "Los Angeles"),
    createTeam(7, "ATL", "Hawks", "Atlanta"),
];
// =============================================================================
// 1. Text Stripping Tests
// =============================================================================
describe("stripHtmlToText", () => {
    it("strips anchor tags and extracts inner text", () => {
        const html = `The <a href="/l/10/roster/ATL/2019">Hawks</a> signed <a href="/l/10/player/797">Zach Collins</a> for $5.82M/year through 2022.`;
        const result = stripHtmlToText(html);
        expect(result).toBe("The Hawks signed Zach Collins for $5.82M/year through 2022.");
    });
    it("handles game highlight text with multiple anchors", () => {
        const html = `<a href="/l/10/player/204">Jayson Tatum</a> had 41 points, 11 rebounds, and 5 assists in a 112-98 win over the <a href="/l/10/roster/MIA/2024">Heat</a>.`;
        const result = stripHtmlToText(html);
        expect(result).toBe("Jayson Tatum had 41 points, 11 rebounds, and 5 assists in a 112-98 win over the Heat.");
    });
    it("handles trade text with multiple teams and players", () => {
        const html = `The <a href="/l/10/roster/LAL/2024">Lakers</a> traded <a href="/l/10/player/102">Anthony Davis</a> to the <a href="/l/10/roster/BOS/2024">Celtics</a> for <a href="/l/10/player/77">Jaylen Brown</a>.`;
        const result = stripHtmlToText(html);
        expect(result).toBe("The Lakers traded Anthony Davis to the Celtics for Jaylen Brown.");
    });
    it("handles plain text without HTML", () => {
        const text = "A player was drafted.";
        const result = stripHtmlToText(text);
        expect(result).toBe("A player was drafted.");
    });
    it("trims whitespace", () => {
        const html = "  Some text with spaces  ";
        const result = stripHtmlToText(html);
        expect(result).toBe("Some text with spaces");
    });
});
// =============================================================================
// 2. Categorization Tests
// =============================================================================
describe("categorizeEvent", () => {
    it("returns low_priority for score < 8", () => {
        const event = createEvent({ score: 5, type: "trade" });
        expect(categorizeEvent(event)).toBe("low_priority");
    });
    it('returns game_highlight for score 8-19 with "had" in text', () => {
        const event = createEvent({
            score: 15,
            type: "someType",
            text: "Player had 30 points",
        });
        expect(categorizeEvent(event)).toBe("game_highlight");
    });
    it('returns transaction for freeAgent with score >= 8 but no "had"', () => {
        const event = createEvent({
            score: 20,
            type: "freeAgent",
            text: "Player signed with team",
        });
        expect(categorizeEvent(event)).toBe("transaction");
    });
    it("returns transaction for trade events", () => {
        const event = createEvent({ score: 20, type: "trade" });
        expect(categorizeEvent(event)).toBe("transaction");
    });
    it("returns transaction for reSigned events", () => {
        const event = createEvent({ score: 20, type: "reSigned" });
        expect(categorizeEvent(event)).toBe("transaction");
    });
    it("returns transaction for release events", () => {
        const event = createEvent({ score: 20, type: "release" });
        expect(categorizeEvent(event)).toBe("transaction");
    });
    it("returns transaction for draft events", () => {
        const event = createEvent({ score: 20, type: "draft" });
        expect(categorizeEvent(event)).toBe("transaction");
    });
    it("returns player_lifecycle for retired events", () => {
        const event = createEvent({ score: 20, type: "retired" });
        expect(categorizeEvent(event)).toBe("player_lifecycle");
    });
    it("returns player_lifecycle for injured events", () => {
        const event = createEvent({ score: 20, type: "injured" });
        expect(categorizeEvent(event)).toBe("player_lifecycle");
    });
    it("returns player_lifecycle for healed events", () => {
        const event = createEvent({ score: 20, type: "healed" });
        expect(categorizeEvent(event)).toBe("player_lifecycle");
    });
    it("returns player_lifecycle for tragicDeath events", () => {
        const event = createEvent({ score: 20, type: "tragicDeath" });
        expect(categorizeEvent(event)).toBe("player_lifecycle");
    });
    it("returns league_milestone for other high-score events", () => {
        const event = createEvent({ score: 25, type: "championship" });
        expect(categorizeEvent(event)).toBe("league_milestone");
    });
    it("returns league_milestone for mvp events", () => {
        const event = createEvent({ score: 20, type: "mvp" });
        expect(categorizeEvent(event)).toBe("league_milestone");
    });
    it("categorizes at boundary: score exactly 8 with 'had'", () => {
        const event = createEvent({
            score: 8,
            type: "generic",
            text: "Player had 20 points",
        });
        expect(categorizeEvent(event)).toBe("game_highlight");
    });
    it("categorizes at boundary: score exactly 19 with 'had'", () => {
        const event = createEvent({
            score: 19,
            type: "generic",
            text: "Player had 20 points",
        });
        expect(categorizeEvent(event)).toBe("game_highlight");
    });
    it("returns league_milestone for score 20 with 'had' (not game_highlight)", () => {
        // Score 20 is outside the 8-19 range for game highlights
        const event = createEvent({
            score: 20,
            type: "generic",
            text: "Player had 50 points",
        });
        expect(categorizeEvent(event)).toBe("league_milestone");
    });
});
// =============================================================================
// 3. Season Filtering Tests
// =============================================================================
describe("parseLeagueEvents - season filtering", () => {
    it("excludes events outside currentSeason", async () => {
        const events = [
            createEvent({ eid: 1, season: 2023, score: 20, type: "freeAgent" }),
            createEvent({ eid: 2, season: 2024, score: 20, type: "freeAgent" }),
            createEvent({ eid: 3, season: 2025, score: 20, type: "freeAgent" }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(1);
        expect(result.parsedEvents[0].eid).toBe(2);
        expect(result.parsedEvents[0].season).toBe(2024);
    });
    it("includes all events matching currentSeason", async () => {
        const events = [
            createEvent({ eid: 1, season: 2024, score: 20, type: "trade" }),
            createEvent({ eid: 2, season: 2024, score: 20, type: "freeAgent" }),
            createEvent({ eid: 3, season: 2024, score: 20, type: "retired" }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(3);
    });
});
// =============================================================================
// 4. Game Matching (Win Perspective) Tests
// =============================================================================
describe("parseScoreFromText - win perspective", () => {
    it('parses "112-98 win" correctly', () => {
        const result = parseScoreFromText("Player had 30 pts in a 112-98 win");
        expect(result).toEqual({ winnerPts: 112, loserPts: 98 });
    });
    it('parses "100-95 win" correctly', () => {
        const result = parseScoreFromText("in a 100-95 win over the team");
        expect(result).toEqual({ winnerPts: 100, loserPts: 95 });
    });
});
// =============================================================================
// 5. Game Matching (Loss Perspective) Tests
// =============================================================================
describe("parseScoreFromText - loss perspective", () => {
    it('parses "98-112 loss" correctly', () => {
        const result = parseScoreFromText("Player had 25 pts in a 98-112 loss");
        expect(result).toEqual({ winnerPts: 112, loserPts: 98 });
    });
    it('parses "95-100 loss" correctly', () => {
        const result = parseScoreFromText("in a 95-100 loss to the team");
        expect(result).toEqual({ winnerPts: 100, loserPts: 95 });
    });
});
describe("parseLeagueEvents - game matching", () => {
    it("matches game highlight event to correct game (win perspective)", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 15,
                type: "highlight",
                text: "Player had 30 pts in a 112-98 win over the Heat",
                tids: [0, 1],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                won: { tid: 0, pts: 112 },
                lost: { tid: 1, pts: 98 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].associatedGameId).toBe(100);
        expect(result.importantGames).toHaveLength(1);
        expect(result.importantGames[0].gid).toBe(100);
    });
    it("matches game highlight event to correct game (loss perspective)", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 15,
                type: "highlight",
                text: "Player had 25 pts in a 98-112 loss to the Celtics",
                tids: [1, 0],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 200,
                season: 2024,
                won: { tid: 0, pts: 112 },
                lost: { tid: 1, pts: 98 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].associatedGameId).toBe(200);
        expect(result.importantGames).toHaveLength(1);
        expect(result.importantGames[0].gid).toBe(200);
    });
});
// =============================================================================
// 6. Deduplication Tests
// =============================================================================
describe("parseLeagueEvents - deduplication", () => {
    it("produces one ImportantGame for two events referencing the same game", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 15,
                type: "highlight",
                text: "Player A had 30 pts in a 112-98 win",
                tids: [0, 1],
                pids: [204],
                season: 2024,
            }),
            createEvent({
                eid: 2,
                score: 12,
                type: "highlight",
                text: "Player B had 25 pts in a 112-98 win",
                tids: [0, 1],
                pids: [77],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                won: { tid: 0, pts: 112 },
                lost: { tid: 1, pts: 98 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(2);
        expect(result.importantGames).toHaveLength(1);
        expect(result.importantGames[0].triggeringEvents).toHaveLength(2);
        expect(result.importantGames[0].triggeringEvents[0].eid).toBe(1);
        expect(result.importantGames[0].triggeringEvents[1].eid).toBe(2);
    });
});
// =============================================================================
// 7. Missing Text Fallback Tests
// =============================================================================
describe("parseLeagueEvents - fallback text", () => {
    it("generates fallback text for freeAgent with no text", async () => {
        const events = [
            createEvent({
                eid: 1,
                type: "freeAgent",
                score: 20,
                pids: [797],
                tids: [7],
                season: 2024,
                // No text field
            }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].text).toBe("Zach Collins signed with the Atlanta Hawks.");
    });
    it("generates fallback text for release with no text", async () => {
        const events = [
            createEvent({
                eid: 1,
                type: "release",
                score: 20,
                pids: [204],
                tids: [0],
                season: 2024,
            }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].text).toBe("The Boston Celtics released Jayson Tatum.");
    });
    it("generates fallback text for retired with no text", async () => {
        const events = [
            createEvent({
                eid: 1,
                type: "retired",
                score: 20,
                pids: [102],
                tids: [],
                season: 2024,
            }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].text).toBe("Anthony Davis retired.");
    });
    it("generates fallback text for trade with no text", async () => {
        const events = [
            createEvent({
                eid: 1,
                type: "trade",
                score: 20,
                pids: [102, 77],
                tids: [5, 0],
                season: 2024,
            }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents[0].text).toBe("A trade was completed involving the Los Angeles Lakers and Boston Celtics.");
    });
});
// =============================================================================
// 8. Threshold Config Tests
// =============================================================================
describe("parseLeagueEvents - threshold config", () => {
    it("includes events at exactly importantGameScoreThreshold", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 10,
                type: "highlight",
                text: "Player had 30 pts in a 100-95 win",
                tids: [0, 1],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                won: { tid: 0, pts: 100 },
                lost: { tid: 1, pts: 95 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
            config: { importantGameScoreThreshold: 10 },
        };
        const result = await parseLeagueEvents(input);
        expect(result.importantGames).toHaveLength(1);
    });
    it("excludes events one below importantGameScoreThreshold from important games", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 9,
                type: "highlight",
                text: "Player had 20 pts in a 100-95 win",
                tids: [0, 1],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                won: { tid: 0, pts: 100 },
                lost: { tid: 1, pts: 95 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
            config: { importantGameScoreThreshold: 10 },
        };
        const result = await parseLeagueEvents(input);
        // Event is still parsed (it's a game_highlight)
        expect(result.parsedEvents).toHaveLength(1);
        expect(result.parsedEvents[0].category).toBe("game_highlight");
        // But it's not flagged as an important game
        expect(result.parsedEvents[0].associatedGameId).toBeNull();
        expect(result.importantGames).toHaveLength(0);
    });
    it("respects custom importantGameScoreThreshold", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 15,
                type: "highlight",
                text: "Player had 30 pts in a 100-95 win",
                tids: [0, 1],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                won: { tid: 0, pts: 100 },
                lost: { tid: 1, pts: 95 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
            config: { importantGameScoreThreshold: 16 },
        };
        const result = await parseLeagueEvents(input);
        // Score 15 is below threshold of 16
        expect(result.importantGames).toHaveLength(0);
        expect(result.parsedEvents[0].associatedGameId).toBeNull();
    });
    it("includes low priority events when includeLowPriorityEvents is true", async () => {
        const events = [
            createEvent({ eid: 1, score: 5, type: "minor", season: 2024 }),
            createEvent({ eid: 2, score: 20, type: "freeAgent", season: 2024 }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
            config: { includeLowPriorityEvents: true },
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(2);
        expect(result.parsedEvents[0].category).toBe("low_priority");
    });
    it("excludes low priority events by default", async () => {
        const events = [
            createEvent({ eid: 1, score: 5, type: "minor", season: 2024 }),
            createEvent({ eid: 2, score: 20, type: "freeAgent", season: 2024 }),
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(1);
        expect(result.parsedEvents[0].eid).toBe(2);
    });
});
// =============================================================================
// Integration Test - Example from Spec
// =============================================================================
describe("parseLeagueEvents - spec example", () => {
    it("parses the freeAgent example from the spec correctly", async () => {
        const events = [
            {
                type: "freeAgent",
                text: `The <a href="/l/10/roster/ATL/2019">Hawks</a> signed <a href="/l/10/player/797">Zach Collins</a> for $5.82M/year through 2022.`,
                tids: [7],
                pids: [797],
                season: 2019,
                eid: 6674,
                score: 20,
            },
        ];
        const input = {
            events,
            games: [],
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2019,
        };
        const result = await parseLeagueEvents(input);
        expect(result.parsedEvents).toHaveLength(1);
        expect(result.parsedEvents[0].text).toBe("The Hawks signed Zach Collins for $5.82M/year through 2022.");
        expect(result.parsedEvents[0].category).toBe("transaction");
        expect(result.parsedEvents[0].eid).toBe(6674);
        expect(result.parsedEvents[0].score).toBe(20);
    });
});
// =============================================================================
// ImportantGame Structure Tests
// =============================================================================
describe("parseLeagueEvents - ImportantGame structure", () => {
    it("populates ImportantGame with correct team info", async () => {
        const events = [
            createEvent({
                eid: 1,
                score: 15,
                type: "highlight",
                text: "Player had 30 pts in a 112-98 win",
                tids: [0, 1],
                season: 2024,
            }),
        ];
        const games = [
            createGame({
                gid: 100,
                season: 2024,
                playoffs: true,
                won: { tid: 0, pts: 112 },
                lost: { tid: 1, pts: 98 },
            }),
        ];
        const input = {
            events,
            games,
            players: defaultPlayers,
            teams: defaultTeams,
            currentSeason: 2024,
        };
        const result = await parseLeagueEvents(input);
        expect(result.importantGames).toHaveLength(1);
        const game = result.importantGames[0];
        expect(game.gid).toBe(100);
        expect(game.season).toBe(2024);
        expect(game.playoffs).toBe(true);
        expect(game.winner.tid).toBe(0);
        expect(game.winner.abbrev).toBe("BOS");
        expect(game.winner.name).toBe("Celtics");
        expect(game.winner.pts).toBe(112);
        expect(game.loser.tid).toBe(1);
        expect(game.loser.abbrev).toBe("MIA");
        expect(game.loser.name).toBe("Heat");
        expect(game.loser.pts).toBe(98);
    });
});
