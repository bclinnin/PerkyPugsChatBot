# Scripts

This folder contains utility scripts and database setup scripts for the Perky Pugs Chat Bot.

## Database Scripts

### `create-dimensiuswinners-table.sql`

Creates the `dimensiuswinners` table for tracking winners in the current World of Warcraft season (Dimensius boss in Manaforge Omega raid).

**Usage:**
```bash
psql $DATABASE_URL -f scripts/create-dimensiuswinners-table.sql
```

**Table Structure:**
- `winid` - UUID primary key (auto-generated)
- `twitchname` - Twitch username (required)
- `realm` - World of Warcraft realm name (required)
- `charactername` - Character name (required)
- `realmcharactercombo` - Combined realm and character identifier (required)
- `windate` - Timestamp of when the win was recorded (auto-set to current timestamp)

**Indexes:**
- `idx_dimensiuswinners_twitchname` - For quick eligibility checks by Twitch username
- `idx_dimensiuswinners_realmcharactercombo` - For quick eligibility checks by character

## Utility Scripts

### `find-royal-voidwing-id.js`

Script to find the mount ID for Royal Voidwing (AOTC mount for Dimensius) by querying a character's mount collection.

**Usage:**
```bash
node scripts/find-royal-voidwing-id.js
```

**Requirements:**
- `BLIZZARD_CLIENTID` and `BLIZZARD_CLIENTSECRET` must be set in `.env` file

**Output:**
- Displays the mount ID for Royal Voidwing (currently: 2606)
- Provides the value to add to `.env` file: `AOTC_MOUNT_ID=2606`

## Adding New Season Tables

When a new World of Warcraft season begins:

1. Create a new SQL file following the naming pattern: `create-<bossname>winners-table.sql`
2. Update the table name in the SQL file
3. Update the codebase to reference the new table name (see `src/modules/dataAccess.js`)
4. Run the script to create the new table in the database

## Notes

- Each season should have its own table to maintain historical data
- The bot code must be updated to reference the new table name when switching seasons
- Old season tables are kept for historical reference

