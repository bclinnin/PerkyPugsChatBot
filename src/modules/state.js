const { RAFFLE } = require('../constants');

class AppState {
    constructor() {
        this.isRaffleOpen = false;
        this.currentWinnerCount = 0;
        this.desiredWinnerCount = RAFFLE.DEFAULT_DESIRED_WINNER_COUNT;
        this.channel = process.env.TWITCH_CHANNEL_NAME;
        this.currentRaffleList = [];
        this.currentRaffleTwitchName = [];
        this.playerFactionDictionary = {};
        this.playerToTwitchNameDictionary = {};
        this.playerOriginalFormatDictionary = {};
        this.currentSessionWinners = [];
        this.modList = process.env.MOD_LIST;
        this.messageFeedEnabled = true;
    }

    // Raffle state management
    openRaffle() {
        this.isRaffleOpen = true;
        this.currentRaffleList = [];
        this.currentRaffleTwitchName = [];
        this.playerOriginalFormatDictionary = {};
        this.currentSessionWinners = [];
    }

    closeRaffle() {
        this.isRaffleOpen = false;
        this.currentWinnerCount = 0;
    }

    setDesiredWinnerCount(count) {
        this.desiredWinnerCount = count;
    }

    incrementWinnerCount() {
        this.currentWinnerCount++;
    }

    resetWinnerCount() {
        this.currentWinnerCount = 0;
    }

    // Player management
    addPlayerToRaffle(realmAndCharacterName, twitchName, faction) {
        this.currentRaffleList.push(realmAndCharacterName);
        this.currentRaffleTwitchName.push(twitchName);
        this.playerFactionDictionary[realmAndCharacterName] = faction;
        this.playerToTwitchNameDictionary[realmAndCharacterName] = twitchName;
    }

    isPlayerInRaffle(realmAndCharacterName) {
        return this.currentRaffleList.includes(realmAndCharacterName);
    }

    isTwitchUserInRaffle(twitchName) {
        return this.currentRaffleTwitchName.includes(twitchName);
    }

    removePlayerFromRaffle(realmAndCharacterName) {
        const index = this.currentRaffleList.indexOf(realmAndCharacterName);
        if (index > -1) {
            this.currentRaffleList.splice(index, 1);
        }
    }

    getRandomPlayer() {
        if (this.currentRaffleList.length === 0) {
            return null;
        }
        const index = Math.floor(Math.random() * this.currentRaffleList.length);
        const player = this.currentRaffleList[index];
        this.currentRaffleList.splice(index, 1);
        return player;
    }

    // Message feed management
    setMessageFeedEnabled(enabled) {
        this.messageFeedEnabled = enabled;
    }

    isMessageFeedEnabled() {
        return this.messageFeedEnabled;
    }

    // Getters
    getRaffleStatus() {
        return {
            isOpen: this.isRaffleOpen,
            currentWinnerCount: this.currentWinnerCount,
            desiredWinnerCount: this.desiredWinnerCount,
            playerCount: this.currentRaffleList.length
        };
    }

    getPlayerInfo(realmAndCharacterName) {
        return {
            faction: this.playerFactionDictionary[realmAndCharacterName],
            twitchName: this.playerToTwitchNameDictionary[realmAndCharacterName]
        };
    }

    // Original format and session winner management
    addOriginalFormat(realmAndCharacterName, originalFormat) {
        this.playerOriginalFormatDictionary[realmAndCharacterName] = originalFormat;
    }

    addSessionWinner(winnerData) {
        this.currentSessionWinners.push(winnerData);
    }

    clearSessionWinners() {
        this.currentSessionWinners = [];
    }

    getSessionWinners() {
        return this.currentSessionWinners;
    }
}

module.exports = AppState;

