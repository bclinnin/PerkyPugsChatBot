// Game Constants
const GAME = {
    MAX_LEVEL: 80,
    AMIRDRASSIL_RAID_ID: 1207,
    FYRAKK_ENCOUNTER_ID: 2519,
    SEASON_3_EXPANSION_ID: 503,
    SEASON_4_EXPANSION_ID: 505,
    DIFFICULTY_HEROIC: 'Heroic'
};

// API Constants
const API = {
    BLIZZARD_AUTH_URL: 'https://us.battle.net/oauth/token',
    BLIZZARD_API_BASE_URL: 'https://us.api.blizzard.com/profile/wow/character',
    NAMESPACE: 'profile-us',
    LOCALE: 'en_US',
    CONTENT_TYPE: 'application/x-www-form-urlencoded'
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
};

// Message Throttling Constants
const MESSAGING = {
    THROTTLE_WINDOW_SECONDS: 30,
    HIGH_PRIORITY_MESSAGE_LIMIT: 95,
    LOW_PRIORITY_MESSAGE_LIMIT: 70,
    USERS_PER_MESSAGE: 25,
    MESSAGE_BUFFER_INTERVAL_MS: 2500,
    CANNED_MESSAGE_INTERVAL_MS: 120000
};

// Raffle/State Constants
const RAFFLE = {
    DEFAULT_DESIRED_WINNER_COUNT: 10,
    DEFAULT_MAX_LEVEL: 80
};

// Command Names
const COMMANDS = {
    ECHO: 'echo',
    SET_WINNERS: 'setwinners',
    ENTER: 'enter',
    OPEN_RAFFLE: 'openraffle',
    CLOSE_RAFFLE: 'closeraffle',
    GET_WINNERS: 'getwinners',
    HELP: 'help',
    APPLY: 'apply',
    ENABLE_FEED: 'enablefeed',
    DISABLE_FEED: 'disablefeed'
};

// Validation Reasons
const VALIDATION_REASONS = {
    MAX_LEVEL: 'maxLevel',
    REMIX: 'remix'
};

// Buffer Types
const BUFFER_TYPES = {
    SUCCESSFUL_ENTER: 'successfulEnter',
    ALREADY_ENTERED: 'alreadyEntered',
    CAN_ONLY_ENTER_ONCE: 'canOnlyEnterOnce',
    WRONG_NAME: 'wrongName',
    REMIX: 'remix',
    MAX_LEVEL: 'maxLevel',
    CANNOT_ENTER: 'cannotEnter'
};

// Axios Retry Configuration
const AXIOS_RETRY_CONFIG = {
    RETRIES: 5,
    RETRY_DELAY: 'exponentialDelay',
    SHOULD_RESET_TIMEOUT: true
};

// Application URLs
const URLS = {
    CARRIER_APPLICATION: 'https://forms.gle/Pn2u8ufDH67TbjmW8'
};

// Message Priority Levels
const MESSAGE_PRIORITY = {
    Low: 0,
    Medium: 1,
    High: 2
};

module.exports = {
    GAME,
    API,
    HTTP_STATUS,
    MESSAGING,
    RAFFLE,
    COMMANDS,
    VALIDATION_REASONS,
    BUFFER_TYPES,
    AXIOS_RETRY_CONFIG,
    URLS,
    MESSAGE_PRIORITY
};
