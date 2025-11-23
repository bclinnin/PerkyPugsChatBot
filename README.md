# Perky Pugs Chat Bot

A modular Twitch chat bot for managing raffles and World of Warcraft character validation. The bot helps manage AOTC (Ahead of the Curve) mount raffles by validating characters and managing entries.

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Twitch bot account with OAuth token
- Blizzard API credentials

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd PerkyPugsChatBot
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with the following variables:
   ```env
   TWITCH_BOT_USERNAME=your_bot_username
   TWITCH_BOT_PASSWORD=oauth:your_oauth_token
   TWITCH_CHANNEL_NAME=your_channel_name
   BLIZZARD_CLIENTID=your_blizzard_client_id
   BLIZZARD_CLIENTSECRET=your_blizzard_client_secret
   DATABASE_URL=postgres://username:password@localhost:5432/database_name
   CURRENT_ENVIRONMENT=local
   API_TIMEOUT_MS=10000
   AOTC_MOUNT_ID=2606
   MOD_LIST=moderator1,moderator2,moderator3
   DEBUG_MODE=false
   ```

3. **Set up the database:**
   Create the winners table for the current season:
   ```bash
   psql $DATABASE_URL -f scripts/create-dimensiuswinners-table.sql
   ```

4. **Start the bot:**
   ```bash
   npm start
   ```

## Bot Commands

### Admin/Moderator Commands
These commands are only available to channel moderators and admins:

- **`!help`** - Display all available commands
- **`!openraffle`** - Open the raffle for entries
- **`!closeraffle`** - Close the raffle to new entries
- **`!getwinners`** - Select and announce winners (only works when raffle is closed)
- **`!setwinners <number>`** - Set how many winners to select (default: 10)
- **`!apply`** - Show carrier application link
- **`!enablefeed`** - Enable message feed
- **`!disablefeed`** - Disable message feed
- **`!echo <message>`** - Echo a message back to chat

### User Commands
Available to all users:

- **`!enter <character>-<realm>`** - Enter the raffle with your character
  - Example: `!enter Thrall-Stormrage`
  - Character must be level 80 (max level)
  - Character must not have killed the current season's boss on Heroic
  - Character must not already have the AOTC mount (Royal Voidwing)
  - No remix characters allowed (MOP Remix, Legion Remix, etc.)
  - Each Twitch account can only enter once per raffle

## How the Raffle Works

1. **Admin opens raffle:** `!openraffle`
2. **Users enter:** `!enter CharacterName-RealmName`
3. **Bot validates character:**
   - Checks if character exists
   - Verifies level 80 (max level)
   - Confirms character is not a remix character (MOP Remix, Legion Remix, etc.)
   - Prevents duplicate entries (by Twitch account and character)
4. **Admin closes raffle:** `!closeraffle`
5. **Admin selects winners:** `!getwinners`
   - Bot validates each winner:
     - Checks database for previous wins (by Twitch account and character)
     - Checks if player has killed the current season's boss on Heroic
     - Checks if player already has the AOTC mount (Royal Voidwing)
   - Ineligible players are skipped automatically
6. **Bot announces winners and resets for next raffle**

## Architecture

The bot uses a modular architecture for maintainability and testability:

```
src/
├── server.js                 # Main application entry point
├── constants/                # Application constants
│   ├── index.js            # Game, API, and configuration constants
│   └── messages.js         # Error messages and message templates
└── modules/                 # Service modules (class-based)
    ├── auth.js             # Blizzard API authentication
    ├── state.js            # Application state management
    ├── messaging.js        # Message throttling and sending
    ├── permissions.js      # User permission checking
    ├── wowApi.js          # World of Warcraft API interactions
    ├── dataAccess.js      # Database access and winner tracking
    ├── raffle.js          # Raffle logic and management
    └── commands.js        # Command handlers and routing
```

## Scripts

Utility scripts are located in the `scripts/` folder:

- `create-dimensiuswinners-table.sql` - SQL script to create the current season's winners table
- `find-royal-voidwing-id.js` - Utility to find mount IDs from Blizzard API

See `scripts/README.md` for detailed documentation.

## Troubleshooting

### Common Issues

1. **Bot not responding to commands:**
   - Check if the bot is connected to Twitch
   - Verify environment variables are set correctly
   - Check console for error messages

2. **Character validation failing:**
   - Ensure character name includes special characters correctly
   - Verify character is level 80 (max level)
   - Check if character is a remix character (MOP Remix, Legion Remix, etc. - not allowed)
   - Ensure format is `CharacterName-RealmName` with hyphens

3. **Database connection issues:**
   - Verify DATABASE_URL is correct
   - Ensure PostgreSQL is running
   - Check database permissions
   - Ensure the `dimensiuswinners` table exists (run setup script if needed)
   - Check CURRENT_ENVIRONMENT is set correctly (local vs production)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── modules/           # Unit tests for individual modules
│   ├── auth.test.js
│   ├── state.test.js
│   ├── messaging.test.js
│   ├── permissions.test.js
│   ├── wowApi.test.js
│   └── raffle.test.js
└── integration/       # Integration tests
    └── server.test.js
```

## Environment Variables

Required environment variables:

- `TWITCH_BOT_USERNAME` - Twitch bot username
- `TWITCH_BOT_PASSWORD` - Twitch bot OAuth token (format: `oauth:your_token`)
- `TWITCH_CHANNEL_NAME` - Channel to connect to
- `BLIZZARD_CLIENTID` - Blizzard API client ID
- `BLIZZARD_CLIENTSECRET` - Blizzard API client secret
- `DATABASE_URL` - PostgreSQL connection string (format: `postgres://user:pass@host:port/dbname`)
- `CURRENT_ENVIRONMENT` - Environment type: `local` or `production` (affects SSL settings)
- `API_TIMEOUT_MS` - API request timeout in milliseconds (default: 10000)
- `AOTC_MOUNT_ID` - Mount ID for AOTC validation (current: 2606 for Royal Voidwing)
- `MOD_LIST` - Comma-separated list of moderators (no spaces, case-insensitive)
- `DEBUG_MODE` - Enable debug logging (`true`/`false`)

## Database

The bot uses PostgreSQL to track previous winners and prevent duplicate wins.

### Current Season Table

- **`dimensiuswinners`** - Tracks winners for the Dimensius (Manaforge Omega) season
  - `winid` - Unique identifier (UUID, auto-generated)
  - `twitchname` - Twitch username (indexed)
  - `realm` - Character realm name
  - `charactername` - Character name
  - `realmcharactercombo` - Combined realm-character identifier (indexed)
  - `windate` - Timestamp of when the win was recorded (auto-set)

### Setup

Create the table using the provided script:
```bash
psql $DATABASE_URL -f scripts/create-dimensiuswinners-table.sql
```

The table includes indexes on `twitchname` and `realmcharactercombo` for fast eligibility checks.

## Features

- **Character Validation**: Validates WoW characters against Blizzard API
  - Level 80 requirement
  - Remix character detection (MOP Remix, Legion Remix, etc.)
  - Boss kill validation (checks if player has killed current season's boss)
  - Mount collection validation (checks if player has AOTC mount)
- **Raffle Management**: Handles entry, validation, and winner selection
- **Message Throttling**: Prevents Twitch rate limit violations
- **Permission System**: Admin/moderator command restrictions
- **Database Integration**: Tracks winners to prevent duplicates (by Twitch account and character)
- **Error Handling**: Comprehensive error handling and retry logic with exponential backoff
- **Modular Architecture**: Class-based services with dependency injection for testability

## Current Season Configuration

- **Raid**: Manaforge Omega (ID: 1302)
- **Boss**: Dimensius, the All-Devouring (Encounter ID: 2691)
- **Difficulty**: Heroic
- **AOTC Mount**: Royal Voidwing (Mount ID: 2606)
- **Max Level**: 80

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

