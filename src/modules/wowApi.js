const axios = require('axios');
const { GAME, API, VALIDATION_REASONS } = require('../constants');
const { ERROR_MESSAGES } = require('../constants/messages');

class WoWApiService {
    constructor(authService) {
        this.authService = authService;
    }

    async fetchPlayerSummary(realm, character) {
        const token = await this.authService.requestAuthToken();
        const getURL = `${API.BLIZZARD_API_BASE_URL}/${realm}/${character}`;
        
        return axios.get(getURL, {
            params: {
                namespace: API.NAMESPACE,
                locale: API.LOCALE
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: process.env.API_TIMEOUT_MS
        });
    }

    async fetchPlayerMounts(playerInfo) {
        console.log('Fetching player mounts');
        if (!playerInfo) {
            console.log(ERROR_MESSAGES.BAIL_OUT_MOUNTS);
            throw new Error(ERROR_MESSAGES.BAIL_OUT_MOUNTS);
        }

        const playerInfoArray = playerInfo.toLowerCase().split('_');
        const realm = playerInfoArray[0];
        const character = playerInfoArray[1];

        const token = await this.authService.requestAuthToken();
        const getURL = `${API.BLIZZARD_API_BASE_URL}/${realm}/${character}/collections/mounts`;
        
        return axios.get(getURL, {
            params: {
                namespace: API.NAMESPACE,
                locale: API.LOCALE
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: process.env.API_TIMEOUT_MS
        });
    }

    async fetchPlayerRaids(playerInfo) {
        console.log('Fetching player raids');
        if (!playerInfo) {
            console.log(ERROR_MESSAGES.BAIL_OUT_RAIDS);
            throw new Error(ERROR_MESSAGES.BAIL_OUT_RAIDS);
        }

        const playerInfoArray = playerInfo.toLowerCase().split('_');
        const realm = playerInfoArray[0];
        const character = playerInfoArray[1];

        const token = await this.authService.requestAuthToken();
        const getURL = `${API.BLIZZARD_API_BASE_URL}/${realm}/${character}/encounters/raids`;
        
        return axios.get(getURL, {
            params: {
                namespace: API.NAMESPACE,
                locale: API.LOCALE
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: process.env.API_TIMEOUT_MS
        });
    }


    parseCharacterAndRealm(args) {
        try {
            // Merge the array back together
            const combined = args.join(' ');

            // Scrape the character name
            const splitByHyphen = combined.split('-');
            const characterName = splitByHyphen.shift().toLowerCase();

            const remainingRealmInfo = splitByHyphen.join('');
            const realmNoWhitespace = remainingRealmInfo.replaceAll(' ', '-');
            const realmNoWhiteSpaceNoSpecialChar = realmNoWhitespace.replaceAll('\'', '').toLowerCase();

            return [characterName, realmNoWhiteSpaceNoSpecialChar];
        } catch {
            throw new Error(ERROR_MESSAGES.PARSE_CHARACTER_FAILED);
        }
    }
}

module.exports = WoWApiService;

