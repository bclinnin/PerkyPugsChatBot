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

    beforeEach(() => {
        jest.clearAllMocks();
        raffleService = new RaffleService(
            mockState,
            mockMessageService,
            mockWowApiService,
            mockPermissionService
        );
    });

    describe('validateCharacterInfo', () => {
        it('should return valid for correct character', () => {
            const characterSummary = {
                data: {
                    level: GAME.MAX_LEVEL,
                    is_remix: false
                }
            };

            const result = raffleService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(true);
        });

        it('should return invalid for wrong level', () => {
            const characterSummary = {
                data: {
                    level: GAME.MAX_LEVEL - 10, // Test with level below max
                    is_remix: false
                }
            };

            const result = raffleService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe(VALIDATION_REASONS.MAX_LEVEL);
        });

        it('should return invalid for remix character', () => {
            const characterSummary = {
                data: {
                    level: GAME.MAX_LEVEL,
                    is_remix: true
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
                        { mount: { id: '123' } },
                        { mount: { id: process.env.AOTC_MOUNT_ID } }
                    ]
                }
            };

            const result = raffleService.findMountInCollection(mountCollection);
            expect(result).toBe(true);
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
});
