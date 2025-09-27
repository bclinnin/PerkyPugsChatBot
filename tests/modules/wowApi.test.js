const WoWApiService = require('../../src/modules/wowApi');
const { VALIDATION_REASONS, GAME } = require('../../src/constants');
const { ERROR_MESSAGES } = require('../../src/constants/messages');

// Mock axios
jest.mock('axios');
const axios = require('axios');

// Mock AuthService
const mockAuthService = {
    requestAuthToken: jest.fn()
};

describe('WoWApiService', () => {
    let wowApiService;

    beforeEach(() => {
        jest.clearAllMocks();
        wowApiService = new WoWApiService(mockAuthService);
    });

    describe('fetchPlayerSummary', () => {
        it('should fetch player summary with correct parameters', async () => {
            mockAuthService.requestAuthToken.mockResolvedValue('test_token');
            const mockResponse = { data: { name: 'test_character' } };
            axios.get.mockResolvedValue(mockResponse);

            await wowApiService.fetchPlayerSummary('test_realm', 'test_character');

            expect(mockAuthService.requestAuthToken).toHaveBeenCalled();
            expect(axios.get).toHaveBeenCalledWith(
                'https://us.api.blizzard.com/profile/wow/character/test_realm/test_character',
                expect.objectContaining({
                    params: expect.objectContaining({
                        namespace: 'profile-us',
                        locale: 'en_US',
                        access_token: 'test_token'
                    })
                })
            );
        });
    });

    describe('fetchPlayerMounts', () => {
        it('should fetch player mounts with correct parameters', async () => {
            mockAuthService.requestAuthToken.mockResolvedValue('test_token');
            const mockResponse = { data: { mounts: [] } };
            axios.get.mockResolvedValue(mockResponse);

            await wowApiService.fetchPlayerMounts('character_realm');

            expect(axios.get).toHaveBeenCalledWith(
                'https://us.api.blizzard.com/profile/wow/character/realm/character/collections/mounts',
                expect.objectContaining({
                    params: expect.objectContaining({
                        access_token: 'test_token'
                    })
                })
            );
        });

        it('should throw error for null player info', async () => {
            await expect(wowApiService.fetchPlayerMounts(null)).rejects.toThrow('Bailing out of fetching player mounts because no info provided.');
        });
    });

    describe('fetchPlayerRaids', () => {
        it('should fetch player raids with correct parameters', async () => {
            mockAuthService.requestAuthToken.mockResolvedValue('test_token');
            const mockResponse = { data: { expansions: [] } };
            axios.get.mockResolvedValue(mockResponse);

            await wowApiService.fetchPlayerRaids('character_realm');

            expect(axios.get).toHaveBeenCalledWith(
                'https://us.api.blizzard.com/profile/wow/character/realm/character/encounters/raids',
                expect.objectContaining({
                    params: expect.objectContaining({
                        access_token: 'test_token'
                    })
                })
            );
        });

        it('should throw error for null player info', async () => {
            await expect(wowApiService.fetchPlayerRaids(null)).rejects.toThrow('Bailing out of fetching player raids because no info provided.');
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

            const result = wowApiService.findMountInCollection(mountCollection);
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

            const result = wowApiService.findMountInCollection(mountCollection);
            expect(result).toBe(false);
        });

        it('should throw error for null collection', () => {
            expect(() => wowApiService.findMountInCollection(null)).toThrow(ERROR_MESSAGES.EMPTY_MOUNT_COLLECTION);
        });
    });

    describe('hasPlayerKilledFyrakk', () => {
        it('should return true when player has killed Fyrakk', () => {
            const raidData = [
                {
                    instance: { id: GAME.AMIRDRASSIL_RAID_ID }, // Amirdrassil
                    modes: [
                        {
                            difficulty: { name: GAME.DIFFICULTY_HEROIC },
                            progress: {
                                encounters: [
                                    {
                                        encounter: { id: GAME.FYRAKK_ENCOUNTER_ID }, // Fyrakk
                                        completed_count: 1
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = wowApiService.hasPlayerKilledFyrakk(raidData);
            expect(result).toBe(true);
        });

        it('should return false when player has not killed Fyrakk', () => {
            const raidData = [
                {
                    instance: { id: GAME.AMIRDRASSIL_RAID_ID },
                    modes: [
                        {
                            difficulty: { name: GAME.DIFFICULTY_HEROIC },
                            progress: {
                                encounters: [
                                    {
                                        encounter: { id: GAME.FYRAKK_ENCOUNTER_ID },
                                        completed_count: 0
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = wowApiService.hasPlayerKilledFyrakk(raidData);
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
                                        encounter: { id: GAME.FYRAKK_ENCOUNTER_ID },
                                        completed_count: 1
                                    }
                                ]
                            }
                        }
                    ]
                }
            ];

            const result = wowApiService.hasPlayerKilledFyrakk(raidData);
            expect(result).toBe(false);
        });
    });

    describe('validateCharacterInfo', () => {
        it('should return valid for correct character', () => {
            const characterSummary = {
                data: {
                    level: GAME.MAX_LEVEL,
                    is_remix: false
                }
            };

            const result = wowApiService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(true);
        });

        it('should return invalid for wrong level', () => {
            const characterSummary = {
                data: {
                    level: GAME.MAX_LEVEL - 10, // Test with level below max
                    is_remix: false
                }
            };

            const result = wowApiService.validateCharacterInfo(characterSummary);
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

            const result = wowApiService.validateCharacterInfo(characterSummary);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe(VALIDATION_REASONS.REMIX);
        });
    });

    describe('parseCharacterAndRealm', () => {
        it('should parse character and realm correctly', () => {
            const args = ['character-name', 'realm-name'];
            
            const result = wowApiService.parseCharacterAndRealm(args);
            
            expect(result).toEqual(['character', 'name-realmname']);
        });

        it('should handle special characters in realm', () => {
            const args = ['character', 'realm with spaces'];
            
            const result = wowApiService.parseCharacterAndRealm(args);
            
            expect(result).toEqual(['character realm with spaces', '']);
        });

        it('should handle apostrophes in realm', () => {
            const args = ['character', 'realm\'with\'apostrophes'];
            
            const result = wowApiService.parseCharacterAndRealm(args);
            
            expect(result).toEqual(['character realm\'with\'apostrophes', '']);
        });

        it('should throw error for invalid input', () => {
            expect(() => wowApiService.parseCharacterAndRealm(null)).toThrow('Failed to parse character and realm information');
        });
    });
});

