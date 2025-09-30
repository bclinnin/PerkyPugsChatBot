// Error Messages
const ERROR_MESSAGES = {
    AUTH_FAILED: 'Failed to authenticate with Blizzard API',
    PARSE_CHARACTER_FAILED: 'Failed to parse character and realm information',
    NO_VALID_PLAYER: 'No valid player was sent in to determine eligibility',
    EMPTY_MOUNT_COLLECTION: 'Received an empty collection of mounts',
    BAIL_OUT_MOUNTS: 'Bailing out of fetching player mounts because no info provided.',
    BAIL_OUT_RAIDS: 'Bailing out of fetching player raids because no info provided.'
};

// Buffer Message Templates
const BUFFER_MESSAGES = {
    SUCCESSFUL_ENTER: ' you are entered.',
    ALREADY_ENTERED: ' you are already entered in the current raffle.',
    CAN_ONLY_ENTER_ONCE: ' you may only enter one character in the raffle.',
    WRONG_NAME: ' I couldn\'t find that character, please ensure that you are giving character-realm. Character name should include any alt codes for special characters.',
    REMIX: ' You cannot enter with a remix character. Please use a standard retail character!',
    MAX_LEVEL: ' The character you entered must be level 70!',
    CANNOT_ENTER: ' The raffle is not accepting new entrants right now. Please wait until the next raffle to enter. Thanks!'
};

// Canned Messages
const CANNED_MESSAGES = [
    'When the raffle is open, type !enter name-realm. Please include any special characters - the bot will @ you to tell you that your character hasn\'t been found, or that you had an error.',
    'No, there is no bad luck protection.',
    'Like what we\'re doing? Donate to our campaign to raise money for Gamers Outreach! https://tiltify.com/+perky-pugs/friendshipdragon2',
    'Interested in learning more about Perky Pugs? Join our Discord! Discord.gg/PerkyPugs',
    'If you are having trouble entering the raffle, please see the #FriendshipDragon2 channel in the Perky Pugs Discord or DM the Modmail bot for more detailed help. Discord.gg/PerkyPugs'
];

// Help Command Message
const HELP_MESSAGE = `The following commands are accepted.  ||||||  
        !echo 'test string to return'  ||||||  
        !setwinners 'number of winners'  ||||||  
        !enter 'character'-'realm'  ||||||  
        !openraffle  ||||||  
        !closeraffle  ||||||  
        !getwinners  ||||||  
        !help  ||||||  
        !apply   ||||||  
        !enablefeed   ||||||  
        !disablefeed   ||||||  `;

module.exports = {
    ERROR_MESSAGES,
    BUFFER_MESSAGES,
    CANNED_MESSAGES,
    HELP_MESSAGE
};
