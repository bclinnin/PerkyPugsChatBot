# Perky Pugs Chat Bot - Administrator Manual

**Last Updated:** Based on current codebase structure  
**Version:** 2.0.0

This manual is designed for administrators and moderators who need to operate and control the Perky Pugs Twitch chat bot. Keep this document updated as the bot evolves.

---

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Admin Commands Reference](#admin-commands-reference)
3. [Raffle Workflow](#raffle-workflow)
4. [Eligibility Rules](#eligibility-rules)
5. [Permission System](#permission-system)
6. [Message Feed System](#message-feed-system)
7. [Troubleshooting](#troubleshooting)
8. [Configuration Reference](#configuration-reference)

---

## Quick Start Guide

### Starting the Bot

1. Ensure all environment variables are configured (see [Configuration Reference](#configuration-reference))
2. Start the bot: `npm start`
3. The bot will automatically connect to Twitch and initialize the database

### Basic Raffle Workflow

1. **Set winner count:** `!setwinners 10` (optional, defaults to 10)
2. **Open raffle:** `!openraffle`
3. **Users enter:** `!enter CharacterName-RealmName`
4. **Close raffle:** `!closeraffle`
5. **Select winners:** `!getwinners`

---

## Admin Commands Reference

All commands below require admin/moderator permissions. See [Permission System](#permission-system) for details.

### `!help`

**Description:** Displays all available commands in chat.

**Usage:** `!help`

**When to use:** Share this command with users who need to see available commands.

---

### `!openraffle`

**Description:** Opens the raffle for new entries. Users can now enter with `!enter` command.

**Usage:** `!openraffle`

**Behavior:**
- Clears the current raffle list
- Allows users to enter the raffle
- If raffle is already open, bot responds: "The raffle is already open"

**When to use:** At the start of each raffle session.

---

### `!closeraffle`

**Description:** Closes the raffle to new entries. Users can no longer enter.

**Usage:** `!closeraffle`

**Behavior:**
- Prevents new entries
- Resets winner count to 0
- If raffle is already closed, bot responds: "The raffle is already closed"

**When to use:** When you're ready to stop accepting entries and select winners.

---

### `!getwinners`

**Description:** Selects and announces winners from the raffle pool. **Only works when raffle is closed.**

**Usage:** `!getwinners`

**Behavior:**
- Resets the current winner count
- Randomly selects a winner from the raffle pool
- Validates eligibility (see [Eligibility Rules](#eligibility-rules))
- If eligible, announces winner and continues until desired winner count is reached
- If ineligible, skips and selects next winner
- Stops when desired winner count is reached or pool is exhausted

**Important Notes:**
- **Must close raffle first** - Command is ignored if raffle is still open
- Automatically continues selecting winners until count is reached
- Each winner is validated before announcement
- Winners are automatically saved to the database

**When to use:** After closing the raffle and ensuring all entries are in.

---

### `!setwinners <number>`

**Description:** Sets how many winners will be selected in the next raffle.

**Usage:** `!setwinners 15`

**Parameters:**
- `<number>` - The number of winners to select (must be a single number)

**Behavior:**
- Updates the desired winner count
- Confirms the new count in chat
- Default is 10 if not set

**Examples:**
- `!setwinners 5` - Select 5 winners
- `!setwinners 20` - Select 20 winners

**When to use:** Before opening a raffle if you want a different number of winners than the default (10).

---

### `!enter <character>-<realm>`

**Description:** Allows users to enter the raffle with their World of Warcraft character. **Available to all users, but admins can enter multiple characters.**

**Usage:** `!enter Thrall-Stormrage`

**Parameters:**
- `<character>` - Character name (case-insensitive)
- `<realm>` - Realm name (case-insensitive, use hyphens for multi-word realms)

**Validation Rules:**
- Character must exist in World of Warcraft
- Character must be level 80 (max level)
- Character cannot be a remix character (MOP Remix, Legion Remix, etc.)
- Each Twitch account can only enter once (admins can enter multiple characters)
- Character must not already be in the current raffle

**User Messages:**
- Success: `@username you are entered.` (buffered, sent periodically)
- Already entered: `@username you are already entered in the current raffle.`
- Wrong name: `@username I couldn't find that character, please ensure that you are giving character-realm. Character name should include any alt codes for special characters.`
- Not max level: `@username The character you entered must be level 80!`
- Remix character: `@username You cannot enter with a remix character. Please use a standard retail character!`
- Raffle closed: `@username The raffle is not accepting new entrants right now. Please wait until the next raffle to enter. Thanks!`

**When to use:** Users enter themselves. Admins can also use this to enter multiple characters.

---

### `!apply`

**Description:** Posts the carrier application link in chat.

**Usage:** `!apply`

**Behavior:**
- Sends the carrier application URL (configured in constants)
- Message priority: Low (may be throttled)

**When to use:** When users ask about applying to be a carrier.

---

### `!enablefeed`

**Description:** Enables the automated message feed system.

**Usage:** `!enablefeed`

**Behavior:**
- Enables periodic canned messages
- Confirms in chat: "messageFeed set to true"

**When to use:** To start automated informational messages.

---

### `!disablefeed`

**Description:** Disables the automated message feed system.

**Usage:** `!disablefeed`

**Behavior:**
- Stops periodic canned messages
- Confirms in chat: "messageFeed set to false"

**When to use:** To stop automated messages (e.g., during announcements or sensitive content).

---

### `!echo <message>`

**Description:** Echoes a message back to chat. Useful for testing or sending custom messages.

**Usage:** `!echo Hello, this is a test message`

**Parameters:**
- `<message>` - Any text message to echo

**Behavior:**
- Sends: `@username, you said: "<message>"`

**When to use:** Testing bot connectivity or sending custom messages.

---

## Raffle Workflow

### Complete Workflow Example

1. **Preparation:**
   ```
   !setwinners 15
   ```

2. **Open Raffle:**
   ```
   !openraffle
   ```
   Bot responds: "The raffle is now open"

3. **Users Enter:**
   Users type: `!enter CharacterName-RealmName`
   Bot validates and adds them to the pool (messages are buffered)

4. **Close Raffle:**
   ```
   !closeraffle
   ```
   Bot responds: "The raffle is now closed"

5. **Select Winners:**
   ```
   !getwinners
   ```
   Bot automatically:
   - Selects random winners
   - Validates each winner
   - Announces eligible winners
   - Continues until 15 winners are selected
   - Saves winners to database

### Raffle State Management

- **Open State:** Users can enter, winners cannot be selected
- **Closed State:** Users cannot enter, winners can be selected
- Each raffle cycle resets the entry list and winner count

---

## Eligibility Rules

When `!getwinners` is executed, each selected winner is validated through multiple checks:

### 1. Database Checks (Fast - Runs First)

**Twitch Account Check:**
- Has this Twitch username won before?
- If yes → Not eligible, message: `@username is not eligible!`

**Character Check:**
- Has this specific character (realm-character combo) won before?
- If yes → Not eligible, message: `@username is not eligible!`

### 2. Boss Kill Check (Slower - API Call)

**Current Boss Validation:**
- Checks if player has killed the current season's boss on Heroic difficulty
- Current boss: **Dimensius** in **Manaforge Omega** (Raid ID: 1302, Encounter ID: 2691)
- If player has already killed the boss → Not eligible, message: `@username is not eligible!`

**Note:** If a player has never killed any raid boss, they pass this check.

### 3. Winner Announcement

If a player passes all checks:
- Winner is saved to database
- Winner is announced: `@username has won a carry with character {{ CharacterName-RealmName }} on [Faction] ! [ModList]`
- Winner count is incremented
- Bot continues to next winner

### Eligibility Summary

A player is **NOT eligible** if:
- ❌ They've won on this Twitch account before
- ❌ They've won with this specific character before
- ❌ They've already killed the current season's boss on Heroic

A player **IS eligible** if:
- ✅ They haven't won before (by Twitch account or character)
- ✅ They haven't killed the current season's boss on Heroic
- ✅ They're in the current raffle pool

---

## Permission System

### Who Can Use Admin Commands?

Admin commands are restricted to users with **any** of the following:

1. **Custom Mod List** (Highest Priority)
   - Users listed in `MOD_LIST` environment variable
   - Format: `MOD_LIST=username1,username2,username3`
   - Case-insensitive matching

2. **Broadcaster**
   - The channel owner/streamer
   - Automatically detected via Twitch badges

3. **Twitch Moderator**
   - Users with moderator status in the channel
   - Automatically detected via Twitch API

### Special Admin Privileges

**Multiple Character Entries:**
- Regular users: Can only enter **one character per Twitch account**
- Admins: Can enter **multiple characters** from the same Twitch account

**All Admin Commands:**
- Only admins can use: `!help`, `!echo`, `!setwinners`, `!openraffle`, `!closeraffle`, `!getwinners`, `!apply`, `!enablefeed`, `!disablefeed`

### User Commands

**Available to Everyone:**
- `!enter` - Enter the raffle (with restrictions)

---

## Message Feed System

### Automated Messages

The bot automatically sends informational messages on a rotation:

**Canned Messages (rotated every 2 minutes):**
1. "When the raffle is open, type !enter name-realm. Please include any special characters - the bot will @ you to tell you that your character hasn't been found, or that you had an error."
2. "No, there is no bad luck protection."
3. "Like what we're doing? Donate to our campaign to raise money for Gamers Outreach! https://tiltify.com/+perky-pugs/friendshipdragon2"
4. "Interested in learning more about Perky Pugs? Join our Discord! Discord.gg/PerkyPugs"
5. "If you are having trouble entering the raffle, please see the #FriendshipDragon2 channel in the Perky Pugs Discord or DM the Modmail bot for more detailed help. Discord.gg/PerkyPugs"

**Control:**
- `!enablefeed` - Start automated messages
- `!disablefeed` - Stop automated messages

### Message Buffering

User feedback messages are buffered and sent in batches to prevent spam:

- Messages are grouped by type (successful enter, errors, etc.)
- Sent every 2.5 seconds
- Up to 25 users per message
- Prevents Twitch rate limiting

### Message Throttling

The bot automatically throttles messages to stay within Twitch limits:

- **High Priority Messages:** Up to 95 messages per 30-second window
- **Low Priority Messages:** Up to 70 messages per 30-second window
- Messages exceeding limits are logged but not sent

---

## Troubleshooting

### Bot Not Responding

**Symptoms:** Commands don't work, no responses in chat

**Solutions:**
1. Check if bot is running: Look for console output
2. Verify Twitch connection: Check for connection errors in console
3. Check environment variables: Ensure all required variables are set
4. Verify bot username: Ensure `TWITCH_BOT_USERNAME` matches the bot account
5. Check OAuth token: Ensure `TWITCH_BOT_PASSWORD` starts with `oauth:`

### Character Validation Failing

**Symptoms:** Users getting "I couldn't find that character" errors

**Solutions:**
1. **Character name format:** Ensure format is `CharacterName-RealmName`
2. **Special characters:** Users must include alt codes for special characters
3. **Realm names:** Multi-word realms should use hyphens (e.g., `Area-52`)
4. **Case sensitivity:** Character and realm names are case-insensitive
5. **API issues:** Check console for Blizzard API errors

### Database Connection Issues

**Symptoms:** Winners not being saved, eligibility checks failing

**Solutions:**
1. Check `DATABASE_URL` format: `postgres://username:password@host:port/database`
2. Verify PostgreSQL is running
3. Check database permissions
4. Review console logs for connection errors
5. Ensure database table exists (see database-schema.sql)

### Winners Not Being Selected

**Symptoms:** `!getwinners` doesn't select winners or stops early

**Solutions:**
1. **Raffle must be closed:** `!getwinners` only works when raffle is closed
2. **Check entry pool:** Ensure users have entered (`!openraffle` must be called first)
3. **Eligibility issues:** Many players may be ineligible (check console logs)
4. **Winner count:** Check if `!setwinners` was set correctly
5. **API errors:** Check console for Blizzard API timeout/error messages

### Message Feed Issues

**Symptoms:** Too many messages, or no automated messages

**Solutions:**
1. **Disable feed:** Use `!disablefeed` to stop automated messages
2. **Enable feed:** Use `!enablefeed` to start automated messages
3. **Throttling:** Bot automatically throttles; excessive messages may be delayed

### Permission Issues

**Symptoms:** Admin commands not working for moderators

**Solutions:**
1. **Add to MOD_LIST:** Add username to `MOD_LIST` environment variable
2. **Check Twitch status:** Ensure user has moderator status in Twitch
3. **Case sensitivity:** MOD_LIST is case-insensitive, but verify spelling
4. **Restart bot:** Changes to MOD_LIST require bot restart

---

## Configuration Reference

### Required Environment Variables

**Twitch Configuration:**
```
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_BOT_PASSWORD=oauth:your_oauth_token
TWITCH_CHANNEL_NAME=your_channel_name
```

**Blizzard API:**
```
BLIZZARD_CLIENTID=your_client_id
BLIZZARD_CLIENTSECRET=your_client_secret
```

**Database:**
```
DATABASE_URL=postgres://username:password@localhost:5432/database_name
CURRENT_ENVIRONMENT=local  # or production (affects SSL settings)
```

**Bot Configuration:**
```
MOD_LIST=moderator1,moderator2,moderator3  # Comma-separated, no spaces
API_TIMEOUT_MS=10000  # API request timeout in milliseconds
AOTC_MOUNT_ID=12345  # Mount ID for validation (if needed)
DEBUG_MODE=false  # Enable debug logging
```

### Game Constants (in code)

**Current Season Configuration:**
- **Max Level:** 80
- **Current Raid:** Manaforge Omega (ID: 1302)
- **Current Boss:** Dimensius (Encounter ID: 2691)
- **Difficulty:** Heroic
- **Default Winner Count:** 10

**Note:** These constants are in `src/constants/index.js` and may need updating for new seasons.

### Message Configuration

**Throttling:**
- Throttle window: 30 seconds
- High priority limit: 95 messages
- Low priority limit: 70 messages
- Users per buffered message: 25
- Buffer interval: 2.5 seconds
- Canned message interval: 2 minutes (120 seconds)

---

## Important Notes

### Database

- Winners are automatically saved to the database
- Database tracks winners by both Twitch username and character
- Each season should use a separate table (see `database-schema.sql`)
- Database is cached on startup for fast eligibility checks

### API Rate Limiting

- Bot includes automatic retry logic for API failures
- Retries up to 5 times with exponential backoff
- Handles 429 (Too Many Requests) and 500 (Server Error) responses
- API timeout is configurable via `API_TIMEOUT_MS`

### Character Validation

- Character must be level 80
- Character cannot be a remix character (MOP Remix, Legion Remix, etc.)
- Character must exist in World of Warcraft
- Character validation happens in real-time via Blizzard API

### Winner Selection

- Winners are selected randomly from the raffle pool
- Selection continues until desired count is reached or pool is exhausted
- Ineligible players are skipped automatically
- Each winner is validated before announcement

---

## Quick Command Cheat Sheet

```
!help                    - Show all commands
!setwinners <number>     - Set winner count (default: 10)
!openraffle              - Open raffle for entries
!closeraffle             - Close raffle
!getwinners               - Select winners (raffle must be closed)
!enter <char>-<realm>     - Enter raffle (users)
!apply                    - Show carrier application
!enablefeed               - Enable automated messages
!disablefeed              - Disable automated messages
!echo <message>           - Echo message to chat
```

---

## Support

For technical issues or questions about the bot:
- Check console logs for error messages
- Review this manual for troubleshooting steps
- Consult the codebase documentation in README.md
- Check database connectivity and API credentials

---

**Remember:** Keep this manual updated as the bot evolves. Add new commands, update workflows, and document any changes to behavior or configuration.

