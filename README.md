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
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
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

4. **Set up Discord webhook (optional):**
   To enable automatic winner posting to Discord:
   - Open your Discord server settings
   - Navigate to Integrations → Webhooks
   - Click "New Webhook"
   - Choose the channel where winners should be posted
   - Copy the webhook URL
   - Add it to your `.env` file as `DISCORD_WEBHOOK_URL`

5. **Set up canned messages:**
   Create the canned messages table:
   ```bash
   psql $DATABASE_URL -f scripts/create-cannedmessages-table.sql
   ```

6. **Set up admin panel (optional):**
   To enable the web-based admin panel for managing canned messages:
   - Add `ADMIN_PANEL_PASSWORD=your_secure_password` to your `.env` file
   - The admin panel will be available at `http://localhost:3000/admin` (local) or `https://your-app.herokuapp.com/admin` (Heroku)

7. **Start the bot:**
   ```bash
   npm start              # Start the bot
   npm run web            # Start the admin panel (optional, separate process)
   ```

## Web Admin Panel

A password-protected web interface for managing canned messages, viewing winner history, and controlling the bot, accessible anytime (even when the bot is offline).

### Features

#### Canned Messages Tab
- Add, edit, and delete canned messages
- Enable/disable messages without deleting them
- Live character counter (500 char Twitch limit)
- Preview messages before saving
- Works independently of the bot

#### Winners Tab
- View complete winner history from the database
- Search by character name, realm, or Twitch username
- Sortable columns (date, character, realm, Twitch)
- Real-time filtering with dynamic search

#### Bot Control Tab
- **Worker Status**: View real-time bot status (running/stopped) with uptime
- **Start/Stop/Restart Worker**: Control the bot dyno remotely
  - Start: Launch the worker when stopped
  - Stop: Shut down the worker when finished with raffles
  - Restart: Restart the worker to apply changes
- **Twitch Channel Config**: Change the channel the bot monitors
- Auto-refresh status every 10 seconds

### Access
- **Local Development:** `http://localhost:3000/admin`
- **Heroku Production:** `https://your-app.herokuapp.com/admin`

### Usage
1. Navigate to the admin panel URL
2. Enter your admin password (set via `ADMIN_PANEL_PASSWORD` environment variable)
3. Use the tab navigation to access different features:
   - **Canned Messages**: Manage bot messages
   - **Winners**: View raffle history
   - **Bot Control**: Monitor and control the worker dyno

### Bot Control Setup

To enable bot control features, you need a Heroku API token:

1. **Generate API Token:**
   - Go to: https://dashboard.heroku.com/account/applications
   - Click "Create authorization"
   - Give it a description (e.g., "Bot Control Panel")
   - Copy the generated token

2. **Add to Environment Variables:**
   ```bash
   # Local (.env file - no quotes)
   HEROKU_API_TOKEN=HRKU-your-token-here
   HEROKU_APP_NAME=your-app-name
   
   # Heroku (via CLI)
   heroku config:set HEROKU_API_TOKEN=your-token -a your-app-name
   heroku config:set HEROKU_APP_NAME=your-app-name -a your-app-name
   ```

3. **Important Notes:**
   - The API token grants full access to your Heroku app
   - Do not use quotes around the token value in `.env`
   - Changing the Twitch channel restarts the web server (brief downtime)
   - If the worker is running when you change the channel, it will also restart (interrupts active raffles)
   - If the worker is stopped, it stays stopped after channel changes

### Heroku Deployment
The `Procfile` defines two process types:
- **`web`** - Admin panel (always running, free on Heroku)
- **`worker`** - Twitch bot (start manually for raffles via admin panel or CLI)

Both processes connect to the same PostgreSQL database, so admins can update messages anytime and the bot will use the latest messages when started.

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
6. **Bot announces winners:**
   - Each winner is announced individually in Twitch chat
   - After all winners are drawn, a formatted list is posted to Discord (if configured)
   - Discord post includes two copy-pasteable code blocks separated by faction (Alliance/Horde)
7. **Ready for next raffle**

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
    ├── discord.js         # Discord webhook integration
    ├── raffle.js          # Raffle logic and management
    └── commands.js        # Command handlers and routing
web/                         # Web admin panel
├── server.js               # Express server
├── middleware/
│   └── auth.js            # Password authentication
├── routes/
│   └── messages.js        # API endpoints for canned messages
├── database/
│   └── db.js              # Database connection utility
└── public/
    ├── index.html         # Admin UI
    ├── style.css          # Styles
    └── app.js             # Frontend JavaScript
```

## Scripts

Utility scripts are located in the `scripts/` folder:

- `create-dimensiuswinners-table.sql` - SQL script to create the current season's winners table
- `create-cannedmessages-table.sql` - SQL script to create the canned messages table with default messages
- `clear-winners.sql` - SQL script to clear all winners from the table
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
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for posting winner lists (optional, format: `https://discord.com/api/webhooks/ID/TOKEN`)
- `ADMIN_PANEL_PASSWORD` - Password for web admin panel access (optional, but required for admin panel)
- `HEROKU_API_TOKEN` - Heroku Platform API token for bot control features (optional, required for Bot Control tab)
- `HEROKU_APP_NAME` - Heroku app name for bot control features (optional, required for Bot Control tab)
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

### Canned Messages Table

- **`cannedmessages`** - Stores rotating informational messages for Twitch chat
  - `messageid` - Unique identifier (auto-incrementing)
  - `messagetext` - Message content (TEXT, max 500 chars recommended for Twitch)
  - `displayorder` - Order in rotation sequence
  - `enabled` - Whether message is active (soft delete flag)
  - `createdat` - Timestamp when message was created
  - `updatedat` - Timestamp when message was last modified

### Setup

Create the tables using the provided scripts:
```bash
psql $DATABASE_URL -f scripts/create-dimensiuswinners-table.sql
psql $DATABASE_URL -f scripts/create-cannedmessages-table.sql
```

The winners table includes indexes on `twitchname` and `realmcharactercombo` for fast eligibility checks.
The canned messages table includes an index on `enabled` and `displayorder` for efficient message rotation.

## Features

- **Character Validation**: Validates WoW characters against Blizzard API
  - Level 80 requirement
  - Remix character detection (MOP Remix, Legion Remix, etc.)
  - Boss kill validation (checks if player has killed current season's boss)
  - Mount collection validation (checks if player has AOTC mount)
- **Raffle Management**: Handles entry, validation, and winner selection
- **Discord Integration**: Posts faction-separated winner lists to Discord
  - Automatic posting after raffle completion
  - Winners separated by faction (Alliance/Horde)
  - Copy-pasteable code blocks for easy in-game invites
  - Preserves original character name formatting with special characters
- **Web Admin Panel**: Comprehensive browser-based management interface
  - Password-protected web interface
  - Works when bot is offline (perfect for Heroku worker model)
  - **Canned Messages**: Real-time message management with character counting and enable/disable
  - **Winners Viewer**: Search and sort complete winner history
  - **Bot Control**: Monitor and control the worker dyno remotely
    - Real-time worker status (running/stopped with uptime)
    - Start/stop/restart worker via web interface
    - Change Twitch channel without SSH/CLI access
    - Auto-refresh status every 10 seconds
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

