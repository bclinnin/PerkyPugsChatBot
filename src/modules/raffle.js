const dataAccess = require('../../dataAccess');
const { GAME, VALIDATION_REASONS, MESSAGE_PRIORITY } = require('../constants');
const { ERROR_MESSAGES } = require('../constants/messages');

class RaffleService {
    constructor(state, messageService, wowApiService, permissionService) {
        this.state = state;
        this.messageService = messageService;
        this.wowApiService = wowApiService;
        this.permissionService = permissionService;
    }

    async handleEnterCommand(args, tags) {
        // Raffle must be open to allow new players to enter
        if (!this.state.isRaffleOpen) {
            this.messageService.addCannotEnter(tags.username);
            return;
        }

        try {
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
            await this.registerPlayerForRaffle(characterSummary, realmAndCharacterName, tags);
        } catch {
            if (this.state.isRaffleOpen) {
                this.messageService.addWrongName(tags.username);
            }
        }
    }

    async registerPlayerForRaffle(characterSummary, realmAndCharacterName, tags) {
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

        const playerFaction = characterSummary.data.faction.type;
        this.state.addPlayerToRaffle(realmAndCharacterName, tags.username, playerFaction);
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

            dataAccess.PersistNewWinner(this.state.playerToTwitchNameDictionary[selectedWinner], playerInfoArray[1], playerInfoArray[0], selectedWinner);
            dataAccess.AddNameToTwitchWinnersList(this.state.playerToTwitchNameDictionary[selectedWinner]);
            dataAccess.AddNameToCharacterWinnersList(selectedWinner);
            
            const playerInfo = this.state.getPlayerInfo(selectedWinner);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 
                `@${playerInfo.twitchName} has won a carry with character {{  ${selectedWinner.replace('_', '-')}  }} on ${playerInfo.faction} ! ${this.state.modList}`);
            
            this.state.incrementWinnerCount();
        } catch (error) {
            console.error('Error determining player eligibility:', error);
            throw error;
        }
    }

    checkDatabaseForEligibility(winner) {
        // See if they have won on this twitch account before
        if (this.state.playerToTwitchNameDictionary[winner] in dataAccess.previousWinnersByTwitchName) {
            console.log(`@${this.state.playerToTwitchNameDictionary[winner]} has won on this twitch account before`);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${this.state.playerToTwitchNameDictionary[winner]} is not eligible!`);
            return false;
        }

        if (winner in dataAccess.previousWinnersByRealmCharacterCombo) {
            console.log(`@${this.state.playerToTwitchNameDictionary[winner]} has won on this WOW character before`);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${this.state.playerToTwitchNameDictionary[winner]} is not eligible!`);
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

        for (const mount of playerMountCollection.data.mounts) {
            if (mount.mount.id === process.env.AOTC_MOUNT_ID) {
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
        } catch (error) {
            console.log(error);
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 
                'An error was encountered while attempting to determine the winners. Please run !setwinners with the number you still want to draw, then run !getwinners again.');
        }
    }
}

module.exports = RaffleService;

