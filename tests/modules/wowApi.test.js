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
                        locale: 'en_US'
                    }),
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test_token'
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

            await wowApiService.fetchPlayerMounts('realm_character');

            expect(axios.get).toHaveBeenCalledWith(
                'https://us.api.blizzard.com/profile/wow/character/realm/character/collections/mounts',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test_token'
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

            await wowApiService.fetchPlayerRaids('realm_character');

            expect(axios.get).toHaveBeenCalledWith(
                'https://us.api.blizzard.com/profile/wow/character/realm/character/encounters/raids',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test_token'
                    })
                })
            );
        });

        it('should throw error for null player info', async () => {
            await expect(wowApiService.fetchPlayerRaids(null)).rejects.toThrow('Bailing out of fetching player raids because no info provided.');
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

