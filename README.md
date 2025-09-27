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
   API_TIMEOUT_MS=10000
   AOTC_MOUNT_ID=12345
   MOD_LIST=moderator1,moderator2,moderator3
   DEBUG_MODE=false
   ```

3. **Start the bot:**
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
  - Character must be max level
  - Character must meet current raid requirements
  - No MOP Remix characters allowed

## How the Raffle Works

1. **Admin opens raffle:** `!openraffle`
2. **Users enter:** `!enter CharacterName-RealmName`
3. **Bot validates character:**
   - Checks if character exists
   - Verifies max level
   - Confirms current raid requirements
   - Prevents duplicate entries
4. **Admin closes raffle:** `!closeraffle`
5. **Admin selects winners:** `!getwinners`
6. **Bot announces winners and resets for next raffle**

## Architecture

The bot uses a modular architecture for maintainability and testability:

```
src/
├── server.js                 # Main application entry point
└── modules/
    ├── auth.js              # Blizzard API authentication
    ├── state.js             # Application state management
    ├── messaging.js         # Message throttling and sending
    ├── permissions.js       # User permission checking
    ├── wowApi.js           # World of Warcraft API interactions
    ├── raffle.js           # Raffle logic and management
    └── commands.js         # Command handlers and routing
```

## Troubleshooting

### Common Issues

1. **Bot not responding to commands:**
   - Check if the bot is connected to Twitch
   - Verify environment variables are set correctly
   - Check console for error messages

2. **Character validation failing:**
   - Ensure character name includes special characters correctly
   - Verify character is max level
   - Check if character meets current raid requirements

3. **Database connection issues:**
   - Verify DATABASE_URL is correct
   - Ensure PostgreSQL is running
   - Check database permissions

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
│   └── commands.test.js
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
- `DATABASE_URL` - PostgreSQL connection string
- `API_TIMEOUT_MS` - API request timeout (default: 10000)
- `AOTC_MOUNT_ID` - Mount ID for AOTC validation
- `MOD_LIST` - Comma-separated list of moderators
- `DEBUG_MODE` - Enable debug logging (true/false)

## Database

The bot uses PostgreSQL to track previous winners and prevent duplicate wins.

### Tables

- `fyrakkWinners` - Stores winner information
  - `twitchName` - Twitch username
  - `realm` - Character realm
  - `characterName` - Character name
  - `realmCharacterCombo` - Combined identifier

## Features

- **Character Validation**: Validates WoW characters against Blizzard API
- **Raffle Management**: Handles entry, validation, and winner selection
- **Message Throttling**: Prevents rate limit violations
- **Permission System**: Admin/moderator command restrictions
- **Database Integration**: Tracks winners to prevent duplicates
- **Error Handling**: Comprehensive error handling and retry logic

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

