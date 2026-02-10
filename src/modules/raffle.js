const { GAME, VALIDATION_REASONS, MESSAGE_PRIORITY } = require('../constants');
const { ERROR_MESSAGES } = require('../constants/messages');

class RaffleService {
    constructor(state, messageService, wowApiService, permissionService, dataAccessService, discordService) {
        this.state = state;
        this.messageService = messageService;
        this.wowApiService = wowApiService;
        this.permissionService = permissionService;
        this.dataAccessService = dataAccessService;
        this.discordService = discordService;
    }

    async handleEnterCommand(args, tags) {
        // Raffle must be open to allow new players to enter
        if (!this.state.isRaffleOpen) {
            this.messageService.addCannotEnter(tags.username);
            return;
        }

        try {
            // Capture original format before parsing
            const originalFormat = args.join(' ');
            
            const [character, realm] = this.wowApiService.parseCharacterAndRealm(args);
            const realmAndCharacterName = `${realm}_${character}`;

            // Players can only enter the raffle once
            if (this.state.isPlayerInRaffle(realmAndCharacterName)) {
                this.messageService.addAlreadyEntered(tags.username);
                return;
            }

            if (!this.permissionService.canTwitchAccountEnterInRaffle(tags, this.state.currentRaffleTwitchName)) {
                this.messageService.addCanOnlyEnterOnce(tags.username);
                return;
            }

            // Fetch character summary and register them for raffle if they exist
            const characterSummary = await this.wowApiService.fetchPlayerSummary(realm, character);
            await this.registerPlayerForRaffle(characterSummary, realmAndCharacterName, tags, originalFormat);
        } catch {
            if (this.state.isRaffleOpen) {
                this.messageService.addWrongName(tags.username);
            }
        }
    }

    async registerPlayerForRaffle(characterSummary, realmAndCharacterName, tags, originalFormat) {
        // Raffle must still be open to register the player
        if (!this.state.isRaffleOpen) {return;}

        const validation = this.validateCharacterInfo(characterSummary);
        if (!validation.valid) {
            if (validation.reason === VALIDATION_REASONS.MAX_LEVEL) {
                this.messageService.addMaxLevel(tags.username);
            } else if (validation.reason === VALIDATION_REASONS.REMIX) {
                this.messageService.addRemix(tags.username);
            }
            return;
        }

        if (this.state.isPlayerInRaffle(realmAndCharacterName)) {
            console.log('Race condition met of player entering multiple times quickly');
            return;
        }

        if (!this.permissionService.canTwitchAccountEnterInRaffle(tags, this.state.currentRaffleTwitchName)) {
            return;
        }

        // Extract canonical names from Blizzard API response
        // This ensures we get the proper realm name with apostrophes (e.g., "Kel'Thuzad")
        // and proper character name casing (e.g., "Orlki" not "orlki")
        const canonicalCharacterName = characterSummary.data.name;
        const canonicalRealmName = characterSummary.data.realm.name;
        const canonicalFormat = `${canonicalCharacterName}-${canonicalRealmName}`;

        const playerFaction = characterSummary.data.faction.type;
        this.state.addPlayerToRaffle(realmAndCharacterName, tags.username, playerFaction);
        this.state.addOriginalFormat(realmAndCharacterName, canonicalFormat);
        this.messageService.addSuccessfulEnter(tags.username);
    }

    async determinePlayerEligibility(selectedWinner) {
        console.log('Determining if player can win');
        if (!selectedWinner) {
            console.log(ERROR_MESSAGES.NO_VALID_PLAYER);
            throw new Error(ERROR_MESSAGES.NO_VALID_PLAYER);
        }

        // Check the quick stuff first and short circuit out if this person isn't eligible
        if (!this.checkDatabaseForEligibility(selectedWinner)) {return;}

        try {
            const playerInfoArray = selectedWinner.toLowerCase().split('_');
            const apiResponse = await this.wowApiService.fetchPlayerRaids(selectedWinner);
            const expansions = apiResponse.data.expansions;

            // If the player has never killed a raid boss, this'll be null, so check
            if (expansions === undefined) {
                console.log('Player has never killed a raid boss');
            } else {
                // Flatten all instances from all expansions into a single array
                const allInstances = [];
                expansions.forEach(expansion => {
                    if (expansion.instances) {
                        allInstances.push(...expansion.instances);
                    }
                });
                
                if (this.hasPlayerKilledDimensius(allInstances)) {
                    console.log(`@${this.state.playerToTwitchNameDictionary[selectedWinner]} already has the appearance and is NOT eligible for a carry!`);
                    this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${this.state.playerToTwitchNameDictionary[selectedWinner]} is not eligible!`);
                    return;
                }
            }

            // Check if player already has the AOTC mount
            if (process.env.AOTC_MOUNT_ID) {
                try {
                    const mountCollection = await this.wowApiService.fetchPlayerMounts(selectedWinner);
                    if (this.findMountInCollection(mountCollection)) {
                        console.log(`@${this.state.playerToTwitchNameDictionary[selectedWinner]} already has the AOTC mount and is NOT eligible for a carry!`);
                        this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${this.state.playerToTwitchNameDictionary[selectedWinner]} is not eligible!`);
                        return;
                    }
                } catch (mountError) {
                    // If mount check fails, log but don't block eligibility (fail open)
                    console.error('Error checking mount collection, continuing with eligibility check:', mountError);
                }
            }

            await this.dataAccessService.persistNewWinner(this.state.playerToTwitchNameDictionary[selectedWinner], playerInfoArray[1], playerInfoArray[0], selectedWinner);
            this.dataAccessService.addNameToTwitchWinnersList(this.state.playerToTwitchNameDictionary[selectedWinner]);
            this.dataAccessService.addNameToCharacterWinnersList(selectedWinner);
            
            const playerInfo = this.state.getPlayerInfo(selectedWinner);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 
                `@${playerInfo.twitchName} has won a carry with character {{  ${selectedWinner.replace('_', '-')}  }} on ${playerInfo.faction} ! ${this.state.modList}`);
            
            // Track this winner for Discord posting
            this.state.addSessionWinner({
                originalFormat: this.state.playerOriginalFormatDictionary[selectedWinner],
                faction: playerInfo.faction,
                twitchName: playerInfo.twitchName
            });
            
            this.state.incrementWinnerCount();
        } catch (error) {
            console.error('Error determining player eligibility:', error);
            throw error;
        }
    }

    checkDatabaseForEligibility(winner) {
        const twitchUsername = this.state.playerToTwitchNameDictionary[winner];
        
        // Admins bypass all eligibility checks
        if (this.permissionService.isUsernameAdmin(twitchUsername)) {
            console.log(`@${twitchUsername} is an admin, bypassing eligibility checks`);
            return true;
        }

        // See if they have won on this twitch account before
        if (this.dataAccessService.hasWonByTwitchName(twitchUsername)) {
            console.log(`@${twitchUsername} has won on this twitch account before`);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${twitchUsername} is not eligible!`);
            return false;
        }

        if (this.dataAccessService.hasWonByCharacter(winner)) {
            console.log(`@${twitchUsername} has won on this WOW character before`);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${twitchUsername} is not eligible!`);
            return false;
        }
        return true;
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

    hasPlayerKilledDimensius(raidData) {
        // Find Manaforge Omega instance
        const manaforgeInstance = raidData.find(instance => 
            instance.instance.id === GAME.MANAFORGE_OMEGA_RAID_ID
        );
        
        if (!manaforgeInstance) {
            return false;
        }
        
        console.log('Found Manaforge Omega');
        
        // Find Heroic difficulty mode
        const heroicMode = manaforgeInstance.modes.find(mode => 
            mode.difficulty.name === GAME.DIFFICULTY_HEROIC
        );
        
        if (!heroicMode) {
            return false;
        }
        
        // Find Dimensius encounter
        const dimensiusEncounter = heroicMode.progress.encounters.find(encounter => 
            encounter.encounter.id === GAME.DIMENSIUS_ENCOUNTER_ID
        );
        
        if (dimensiusEncounter && dimensiusEncounter.completed_count > 0) {
            console.log('This player has killed Dimensius on heroic before');
            return true;
        }
        
        return false;
    }

    findMountInCollection(playerMountCollection) {
        console.log('Parsing mounts');
        if (!playerMountCollection) {
            console.log(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
            throw new Error(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
        }

        // Convert mount ID to number for comparison (API returns numbers, env var is string)
        const targetMountId = parseInt(process.env.AOTC_MOUNT_ID, 10);
        
        if (isNaN(targetMountId)) {
            console.log('AOTC_MOUNT_ID is not a valid number, skipping mount check');
            return false;
        }

        for (const mount of playerMountCollection.data.mounts) {
            // Handle both string and number ID formats
            const mountId = typeof mount.mount.id === 'number' ? mount.mount.id : parseInt(mount.mount.id, 10);
            if (mountId === targetMountId) {
                console.log(`Found AOTC mount (ID: ${targetMountId}) in player collection`);
                return true;
            }
        }
        return false;
    }

    shouldContinueDrawingWinners() {
        console.log('Figuring out if I should continue');
        // Handle the case of our list being exhausted
        if (this.state.currentRaffleList.length === 0) {
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'There are no more potential winners to be chosen');
            return false;
        }
        if (this.state.currentWinnerCount >= this.state.desiredWinnerCount) {
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'The max number of winners for this run has been reached!');
            return false;
        }
        return true;
    }

    selectWinnerFromList() {
        console.log('Selecting winner');
        // Handle the case of our list being exhausted
        if (this.state.currentRaffleList.length === 0) {
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'There are no more potential winners to be chosen');
            return null;
        }

        return this.state.getRandomPlayer();
    }

    async handleGetWinnersCommand(args, tags) {
        if (this.state.isRaffleOpen) {return;}

        try {
            const winner = this.selectWinnerFromList();
            if (!winner) {return;}

            await this.determinePlayerEligibility(winner);
            
            if (this.shouldContinueDrawingWinners()) {
                return this.handleGetWinnersCommand(args, tags);
            }
            
            // All winners have been drawn, post to Discord
            try {
                await this.discordService.postWinnersToDiscord(this.state.getSessionWinners());
            } catch (discordError) {
                console.error('Discord posting failed, but raffle completed successfully:', discordError);
                // Don't throw - Discord errors shouldn't break the raffle
            }
        } catch (error) {
            console.log(error);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 
                'An error was encountered while attempting to determine the winners. Please run !setwinners with the number you still want to draw, then run !getwinners again.');
        }
    }
}

module.exports = RaffleService;

