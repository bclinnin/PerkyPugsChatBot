const DataAccessService = require('../../src/modules/dataAccess');
const {Client} = require('pg');

// Mock pg module
jest.mock('pg', () => {
    const mockClient = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn()
    };
    return {
        Client: jest.fn(() => mockClient)
    };
});

describe('DataAccessService', () => {
    let dataAccessService;
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        dataAccessService = new DataAccessService();
        mockClient = new Client();
    });

    describe('constructor', () => {
        it('should initialize with empty caches', () => {
            expect(dataAccessService.client).toBeNull();
            expect(dataAccessService.previousWinnersByTwitchName).toEqual({});
            expect(dataAccessService.previousWinnersByRealmCharacterCombo).toEqual({});
        });
    });

    describe('getDatabaseClient', () => {
        it('should return client without SSL for local environment', () => {
            process.env.CURRENT_ENVIRONMENT = 'local';
            process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
            
            const client = dataAccessService.getDatabaseClient();
            
            expect(Client).toHaveBeenCalledWith({
                connectionString: 'postgres://user:pass@localhost:5432/db'
            });
        });

        it('should return client with SSL for production environment', () => {
            process.env.CURRENT_ENVIRONMENT = 'production';
            process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
            
            const client = dataAccessService.getDatabaseClient();
            
            expect(Client).toHaveBeenCalledWith({
                connectionString: 'postgres://user:pass@localhost:5432/db',
                ssl: {
                    rejectUnauthorized: false
                }
            });
        });
    });

    describe('startup', () => {
        it('should connect to database and populate lookups', async () => {
            const mockResult = {
                rowCount: 2,
                rows: [
                    { twitchname: 'user1', realmcharactercombo: 'realm1_char1' },
                    { twitchname: 'user2', realmcharactercombo: 'realm2_char2' }
                ]
            };
            
            mockClient.connect.mockResolvedValue(undefined);
            mockClient.query.mockResolvedValue(mockResult);
            
            await dataAccessService.startup();
            
            expect(mockClient.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('select * from dimensiuswinners');
            expect(dataAccessService.previousWinnersByTwitchName).toEqual({
                'user1': 1,
                'user2': 1
            });
            expect(dataAccessService.previousWinnersByRealmCharacterCombo).toEqual({
                'realm1_char1': 1,
                'realm2_char2': 1
            });
        });

        it('should handle connection errors', async () => {
            const error = new Error('Connection failed');
            mockClient.connect.mockRejectedValue(error);
            
            await expect(dataAccessService.startup()).rejects.toThrow('Connection failed');
        });
    });

    describe('addNameToTwitchWinnersList', () => {
        it('should add new twitch name to list', () => {
            dataAccessService.addNameToTwitchWinnersList('newuser');
            expect(dataAccessService.previousWinnersByTwitchName).toEqual({ 'newuser': 1 });
        });

        it('should increment count for existing twitch name', () => {
            dataAccessService.previousWinnersByTwitchName['existinguser'] = 1;
            dataAccessService.addNameToTwitchWinnersList('existinguser');
            expect(dataAccessService.previousWinnersByTwitchName['existinguser']).toBe(2);
        });
    });

    describe('addNameToCharacterWinnersList', () => {
        it('should add new character to list', () => {
            dataAccessService.addNameToCharacterWinnersList('realm_character');
            expect(dataAccessService.previousWinnersByRealmCharacterCombo).toEqual({ 'realm_character': 1 });
        });

        it('should increment count for existing character', () => {
            dataAccessService.previousWinnersByRealmCharacterCombo['realm_character'] = 1;
            dataAccessService.addNameToCharacterWinnersList('realm_character');
            expect(dataAccessService.previousWinnersByRealmCharacterCombo['realm_character']).toBe(2);
        });
    });

    describe('persistNewWinner', () => {
        beforeEach(() => {
            dataAccessService.client = mockClient;
        });

        it('should insert new winner into database', async () => {
            mockClient.query.mockResolvedValue({});
            
            await dataAccessService.persistNewWinner('twitchuser', 'realm', 'character', 'realm_character');
            
            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO dimensiuswinners (twitchname,realm,charactername,realmcharactercombo) VALUES ($1,$2,$3,$4)',
                ['twitchuser', 'realm', 'character', 'realm_character']
            );
        });

        it('should handle database errors', async () => {
            const error = new Error('Database error');
            mockClient.query.mockRejectedValue(error);
            
            await expect(dataAccessService.persistNewWinner('user', 'realm', 'char', 'combo'))
                .rejects.toThrow('Database error');
        });
    });

    describe('hasWonByTwitchName', () => {
        it('should return true if twitch name has won', () => {
            dataAccessService.previousWinnersByTwitchName['winner'] = 1;
            expect(dataAccessService.hasWonByTwitchName('winner')).toBe(true);
        });

        it('should return false if twitch name has not won', () => {
            expect(dataAccessService.hasWonByTwitchName('newuser')).toBe(false);
        });
    });

    describe('hasWonByCharacter', () => {
        it('should return true if character has won', () => {
            dataAccessService.previousWinnersByRealmCharacterCombo['realm_char'] = 1;
            expect(dataAccessService.hasWonByCharacter('realm_char')).toBe(true);
        });

        it('should return false if character has not won', () => {
            expect(dataAccessService.hasWonByCharacter('realm_newchar')).toBe(false);
        });
    });

    describe('getPreviousWinnersByTwitchName', () => {
        it('should return the twitch winners dictionary', () => {
            dataAccessService.previousWinnersByTwitchName = { 'user1': 1, 'user2': 2 };
            const result = dataAccessService.getPreviousWinnersByTwitchName();
            expect(result).toEqual({ 'user1': 1, 'user2': 2 });
        });
    });

    describe('getPreviousWinnersByRealmCharacterCombo', () => {
        it('should return the character winners dictionary', () => {
            dataAccessService.previousWinnersByRealmCharacterCombo = { 'realm1_char1': 1 };
            const result = dataAccessService.getPreviousWinnersByRealmCharacterCombo();
            expect(result).toEqual({ 'realm1_char1': 1 });
        });
    });
});

