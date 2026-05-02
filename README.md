# events-spec-bbgm

Parses and categorizes events from BBGM (Basketball GM) league exports. Strips HTML from event text, categorizes events by type/importance, and identifies games associated with highlight events.

## Install

```bash
npm install
npm run build
```

Project Structure

events-spec-bbgm/
├── src/
│ ├── types.ts # All TypeScript interfaces
│ ├── utils.ts # HTML stripping, categorization, game matching
│ ├── parser.ts # Main parseLeagueEvents function (5-stage pipeline)
│ ├── parser.test.ts # Unit tests
│ └── index.ts # Public exports
├── package.json
└── tsconfig.json

What's Implemented

Main function: parseLeagueEvents(input) - processes raw BBGM data through a 5-stage pipeline:

1. Filter to current season
2. Categorize by score + type
3. Parse text (strip HTML, generate fallbacks)
4. Match game highlights to games
5. Assemble output

Exports:

- parseLeagueEvents - main function
- All types from the spec (BBGMEvent, ParsedEvent, ImportantGame, etc.)
- Utility functions for advanced usage

Tests cover all 8 areas from the spec:

- Text stripping
- Categorization logic
- Season filtering
- Game matching (win/loss perspectives)
- Deduplication
- Missing text fallbacks
- Threshold configuration

## Usage

```typescript
import { parseLeagueEvents } from "events-spec-bbgm";

const result = await parseLeagueEvents({
  events: bbgmExport.events,
  games: bbgmExport.games,
  players: bbgmExport.players,
  teams: bbgmExport.teams,
  currentSeason: bbgmExport.gameAttributes.season,
  config: {
    importantGameScoreThreshold: 10, // default
    includeLowPriorityEvents: false, // default
  },
});

result.parsedEvents; // ParsedEvent[] - categorized events with plain text
result.importantGames; // ImportantGame[] - games with high-importance highlights
```

## Event Categories

| Category           | Description                               |
| ------------------ | ----------------------------------------- |
| `transaction`      | trades, signings, releases, draft picks   |
| `player_lifecycle` | injuries, retirements, deaths             |
| `league_milestone` | awards, playoffs, championships           |
| `game_highlight`   | standout player performances (score 8-19) |
| `low_priority`     | routine events (score < 8)                |

## Tests

```bash
npm test
```
