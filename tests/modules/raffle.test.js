const RaffleService = require('../../src/modules/raffle');
const { GAME, VALIDATION_REASONS } = require('../../src/constants');
const { ERROR_MESSAGES } = require('../../src/constants/messages');

// Mock dependencies
const mockState = {
    isRaffleOpen: true,
    isPlayerInRaffle: jest.fn(),
    addPlayerToRaffle: jest.fn(),
    getPlayerInfo: jest.fn(),
    playerToTwitchNameDictionary: {},
    currentRaffleTwitchName: 'testchannel'
};

const mockMessageService = {
    addCannotEnter: jest.fn(),
    addAlreadyEntered: jest.fn(),
    addCanOnlyEnterOnce: jest.fn(),
    addWrongName: jest.fn(),
    addMaxLevel: jest.fn(),
    addRemix: jest.fn(),
    addSuccessfulEnter: jest.fn(),
    sendMessage: jest.fn()
};

const mockWowApiService = {
    parseCharacterAndRealm: jest.fn(),
    fetchPlayerSummary: jest.fn(),
    fetchPlayerRaids: jest.fn()
};

const mockPermissionService = {
    canTwitchAccountEnterInRaffle: jest.fn()
};

describe('RaffleService', () => {
    let raffleService;
    let mockDataAccessService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Set AOTC_MOUNT_ID for mount tests
        process.env.AOTC_MOUNT_ID = '2606';
        
        mockDataAccessService = {
            hasWonByTwitchName: jest.fn(),
            hasWonByCharacter: jest.fn(),
            persistNewWinner: jest.fn(),
            addNameToTwitchWinnersList: jest.fn(),
            addNameToCharacterWinnersList: jest.fn()
        };
        
        raffleService = new RaffleService(
            mockState,
            mockMessageService,
            mockWowApiService,
            mockPermissionService,
            mockDataAccessService
        );
    });

    describe('validateCharacterInfo', () => {
        it('should return valid for correct character', () => {
        const characterSummary = {
            data: {
                name: 'Testchar',
                level: GAME.MAX_LEVEL,
                is_remix: false,
                realm: {
                    name: 'Test Realm',
                    slug: 'test-realm',
                    id: 1
                },
                faction: {
                    type: 'ALLIANCE',
                    name: 'Alliance'
                }
            }
        };

            const result = raffleService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(true);
        });

        it('should return invalid for wrong level', () => {
            const characterSummary = {
                data: {
                    name: 'Testchar',
                    level: GAME.MAX_LEVEL - 10, // Test with level below max
                    is_remix: false,
                    realm: {
                        name: 'Test Realm',
                        slug: 'test-realm',
                        id: 1
                    },
                    faction: {
                        type: 'ALLIANCE',
                        name: 'Alliance'
                    }
                }
            };

            const result = raffleService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe(VALIDATION_REASONS.MAX_LEVEL);
        });

        it('should return invalid for remix character', () => {
            const characterSummary = {
                data: {
                    name: 'Testchar',
                    level: GAME.MAX_LEVEL,
                    is_remix: true,
                    realm: {
                        name: 'Test Realm',
                        slug: 'test-realm',
                        id: 1
                    },
                    faction: {
                        type: 'ALLIANCE',
                        name: 'Alliance'
                    }
                }
            };

            const result = raffleService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe(VALIDATION_REASONS.REMIX);
        });
    });

    describe('hasPlayerKilledDimensius', () => {
        it('should return true when player has killed Dimensius', () => {
            const raidData = [
                {
                    instance: { id: GAME.MANAFORGE_OMEGA_RAID_ID }, // Manaforge Omega
                    modes: [
                        {
                            difficulty: { name: GAME.DIFFICULTY_HEROIC },
                            progress: {
                                encounters: [
                                    {
                                        encounter: { id: GAME.DIMENSIUS_ENCOUNTER_ID }, // Dimensius
                                        completed_count: 1
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = raffleService.hasPlayerKilledDimensius(raidData);
            expect(result).toBe(true);
        });

        it('should return false when player has not killed Dimensius', () => {
            const raidData = [
                {
                    instance: { id: GAME.MANAFORGE_OMEGA_RAID_ID },
                    modes: [
                        {
                            difficulty: { name: GAME.DIFFICULTY_HEROIC },
                            progress: {
                                encounters: [
                                    {
                                        encounter: { id: GAME.DIMENSIUS_ENCOUNTER_ID },
                                        completed_count: 0
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = raffleService.hasPlayerKilledDimensius(raidData);
            expect(result).toBe(false);
        });

        it('should return false for wrong instance', () => {
            const raidData = [
                {
                    instance: { id: 999 }, // Different instance ID
                    modes: [
                        {
                            difficulty: { name: GAME.DIFFICULTY_HEROIC },
                            progress: {
                                encounters: [
                                    {
                                        encounter: { id: GAME.DIMENSIUS_ENCOUNTER_ID },
                                        completed_count: 1
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = raffleService.hasPlayerKilledDimensius(raidData);
            expect(result).toBe(false);
        });
    });

    describe('findMountInCollection', () => {
        it('should return true when mount is found', () => {
            const mountCollection = {
                data: {
                    mounts: [
                        { mount: { id: 123 } },
                        { mount: { id: 2606 } } // Royal Voidwing mount ID
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(true);
        });

        it('should return true when mount is found with string ID', () => {
            const mountCollection = {
                data: {
                    mounts: [
                        { mount: { id: '123' } },
                        { mount: { id: '2606' } } // Royal Voidwing mount ID as string
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(true);
        });

        it('should return false when AOTC_MOUNT_ID is not set', () => {
            delete process.env.AOTC_MOUNT_ID;
            const mountCollection = {
                data: {
                    mounts: [
                        { mount: { id: 2606 } }
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(false);
            
            // Restore for other tests
            process.env.AOTC_MOUNT_ID = '2606';
        });

        it('should return false when AOTC_MOUNT_ID is invalid', () => {
            process.env.AOTC_MOUNT_ID = 'invalid';
            const mountCollection = {
                data: {
                    mounts: [
                        { mount: { id: 2606 } }
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(false);
            
            // Restore for other tests
            process.env.AOTC_MOUNT_ID = '2606';
        });

        it('should return false when mount is not found', () => {
            const mountCollection = {
                data: {
                    mounts: [
                        { mount: { id: '123' } },
                        { mount: { id: '456' } }
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(false);
        });

        it('should throw error for null collection', () => {
            expect(() => raffleService.findMountInCollection(null)).toThrow(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
        });
    });

    describe('checkDatabaseForEligibility', () => {
        beforeEach(() => {
            mockState.playerToTwitchNameDictionary = {
                'realm_character': 'twitchuser'
            };
        });

        it('should return false if twitch name has won before', () => {
            mockDataAccessService.hasWonByTwitchName.mockReturnValue(true);
            
            const result = raffleService.checkDatabaseForEligibility('realm_character');
            
            expect(result).toBe(false);
            expect(mockDataAccessService.hasWonByTwitchName).toHaveBeenCalledWith('twitchuser');
            expect(mockMessageService.sendMessage).toHaveBeenCalled();
        });

        it('should return false if character has won before', () => {
            mockDataAccessService.hasWonByTwitchName.mockReturnValue(false);
            mockDataAccessService.hasWonByCharacter.mockReturnValue(true);
            
            const result = raffleService.checkDatabaseForEligibility('realm_character');
            
            expect(result).toBe(false);
            expect(mockDataAccessService.hasWonByCharacter).toHaveBeenCalledWith('realm_character');
            expect(mockMessageService.sendMessage).toHaveBeenCalled();
        });

        it('should return true if player has not won before', () => {
            mockDataAccessService.hasWonByTwitchName.mockReturnValue(false);
            mockDataAccessService.hasWonByCharacter.mockReturnValue(false);
            
            const result = raffleService.checkDatabaseForEligibility('realm_character');
            
            expect(result).toBe(true);
        });
    });

    describe('determinePlayerEligibility', () => {
        beforeEach(() => {
            mockState.playerToTwitchNameDictionary = {
                'realm_character': 'twitchuser'
            };
            mockState.getPlayerInfo = jest.fn().mockReturnValue({
                twitchName: 'twitchuser',
                faction: 'ALLIANCE'
            });
            mockState.incrementWinnerCount = jest.fn();
            mockDataAccessService.hasWonByTwitchName.mockReturnValue(false);
            mockDataAccessService.hasWonByCharacter.mockReturnValue(false);
            mockWowApiService.fetchPlayerRaids.mockResolvedValue({
                data: { expansions: [] }
            });
        });

        it('should throw error if no winner provided', async () => {
            await expect(raffleService.determinePlayerEligibility(null))
                .rejects.toThrow(ERROR_MESSAGES.NO_VALID_PLAYER);
        });

        it('should return early if database check fails', async () => {
            mockDataAccessService.hasWonByTwitchName.mockReturnValue(true);
            
            await raffleService.determinePlayerEligibility('realm_character');
            
            expect(mockWowApiService.fetchPlayerRaids).not.toHaveBeenCalled();
            expect(mockDataAccessService.persistNewWinner).not.toHaveBeenCalled();
        });

        it('should check mount collection if AOTC_MOUNT_ID is set', async () => {
            process.env.AOTC_MOUNT_ID = '2606';
            mockWowApiService.fetchPlayerMounts = jest.fn().mockResolvedValue({
                data: { mounts: [{ mount: { id: 2606 } }] }
            });
            
            await raffleService.determinePlayerEligibility('realm_character');
            
            expect(mockWowApiService.fetchPlayerMounts).toHaveBeenCalledWith('realm_character');
            expect(mockMessageService.sendMessage).toHaveBeenCalled();
            expect(mockDataAccessService.persistNewWinner).not.toHaveBeenCalled();
        });

        it('should continue if mount check fails (fail open)', async () => {
            process.env.AOTC_MOUNT_ID = '2606';
            mockWowApiService.fetchPlayerMounts = jest.fn().mockRejectedValue(new Error('API error'));
            mockWowApiService.fetchPlayerRaids.mockResolvedValue({
                data: { expansions: [] }
            });
            
            await raffleService.determinePlayerEligibility('realm_character');
            
            // Should still persist winner even if mount check fails
            expect(mockDataAccessService.persistNewWinner).toHaveBeenCalled();
        });

        it('should persist winner if all checks pass', async () => {
            process.env.AOTC_MOUNT_ID = '2606';
            mockWowApiService.fetchPlayerMounts = jest.fn().mockResolvedValue({
                data: { mounts: [{ mount: { id: 123 } }] } // Mount not found
            });
            
            await raffleService.determinePlayerEligibility('realm_character');
            
            expect(mockDataAccessService.persistNewWinner).toHaveBeenCalledWith(
                'twitchuser',
                'character',
                'realm',
                'realm_character'
            );
            expect(mockDataAccessService.addNameToTwitchWinnersList).toHaveBeenCalledWith('twitchuser');
            expect(mockDataAccessService.addNameToCharacterWinnersList).toHaveBeenCalledWith('realm_character');
            expect(mockState.incrementWinnerCount).toHaveBeenCalled();
        });

        it('should skip mount check if AOTC_MOUNT_ID is not set', async () => {
            delete process.env.AOTC_MOUNT_ID;
            mockWowApiService.fetchPlayerMounts = jest.fn();
            
            await raffleService.determinePlayerEligibility('realm_character');
            
            expect(mockWowApiService.fetchPlayerMounts).not.toHaveBeenCalled();
            expect(mockDataAccessService.persistNewWinner).toHaveBeenCalled();
        });
    });
});
