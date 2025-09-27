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
                locale: API.LOCALE,
                access_token: token
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
        const character = playerInfoArray[0];
        const realm = playerInfoArray[1];

        const token = await this.authService.requestAuthToken();
        const getURL = `${API.BLIZZARD_API_BASE_URL}/${realm}/${character}/collections/mounts`;
        
        return axios.get(getURL, {
            params: {
                namespace: API.NAMESPACE,
                locale: API.LOCALE,
                access_token: token
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
        const character = playerInfoArray[0];
        const realm = playerInfoArray[1];

        const token = await this.authService.requestAuthToken();
        const getURL = `${API.BLIZZARD_API_BASE_URL}/${realm}/${character}/encounters/raids`;
        
        return axios.get(getURL, {
            params: {
                namespace: API.NAMESPACE,
                locale: API.LOCALE,
                access_token: token
            },
            timeout: process.env.API_TIMEOUT_MS
        });
    }

    findMountInCollection(playerMountCollection) {
        console.log('Parsing mounts');
        if (!playerMountCollection) {
            console.log(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
            throw new Error(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
        }

        for (const mount of playerMountCollection.data.mounts) {
            if (mount.mount.id === process.env.AOTC_MOUNT_ID) {
                return true;
            }
        }
        return false;
    }

    hasPlayerKilledFyrakk(raidData) {
        // Enumerate the instances to find Amirdrassil
        for (const instance of raidData) {
            // Check for Amirdrassil raid ID
            if (instance.instance.id !== GAME.AMIRDRASSIL_RAID_ID) {continue;}
            
            console.log('Found s3 amirdrassil');
            
            for (const difficulty of instance.modes) {
                if (difficulty.difficulty.name !== GAME.DIFFICULTY_HEROIC) {continue;}
                
                for (const encounter of difficulty.progress.encounters) {
                    // Fyrakk encounter id
                    if (encounter.encounter.id !== GAME.FYRAKK_ENCOUNTER_ID) {continue;}
                    
                    if (encounter.completed_count > 0) {
                        console.log('This player has killed Fyrakk on heroic before');
                        return true;
                    }
                }
            }
        }
        return false;
    }

    validateCharacterInfo(characterSummary) {
        if (characterSummary.data.level !== GAME.MAX_LEVEL) {
            return { valid: false, reason: VALIDATION_REASONS.MAX_LEVEL };
        }

        if (characterSummary.data.is_remix === true) {
            return { valid: false, reason: VALIDATION_REASONS.REMIX };
        }

        return { valid: true };
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

