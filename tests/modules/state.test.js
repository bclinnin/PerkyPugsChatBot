const AppState = require('../../src/modules/state');
const { RAFFLE } = require('../../src/constants');

describe('AppState', () => {
    let state;

    beforeEach(() => {
        // Mock environment variables
        process.env.TWITCH_CHANNEL_NAME = 'test_channel';
        process.env.MOD_LIST = 'test_mods';
        
        state = new AppState();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(state.isRaffleOpen).toBe(false);
            expect(state.currentWinnerCount).toBe(0);
            expect(state.desiredWinnerCount).toBe(RAFFLE.DEFAULT_DESIRED_WINNER_COUNT);
            expect(state.channel).toBe('test_channel');
            expect(state.currentRaffleList).toEqual([]);
            expect(state.currentRaffleTwitchName).toEqual([]);
            expect(state.messageFeedEnabled).toBe(true);
        });
    });

    describe('raffle management', () => {
        it('should open raffle and clear lists', () => {
            state.currentRaffleList = ['existing_player'];
            state.currentRaffleTwitchName = ['existing_user'];
            
            state.openRaffle();
            
            expect(state.isRaffleOpen).toBe(true);
            expect(state.currentRaffleList).toEqual([]);
            expect(state.currentRaffleTwitchName).toEqual([]);
        });

        it('should close raffle and reset winner count', () => {
            state.isRaffleOpen = true;
            state.currentWinnerCount = 5;
            
            state.closeRaffle();
            
            expect(state.isRaffleOpen).toBe(false);
            expect(state.currentWinnerCount).toBe(0);
        });

        it('should set desired winner count', () => {
            const testCount = 15;
            state.setDesiredWinnerCount(testCount);
            expect(state.desiredWinnerCount).toBe(testCount);
        });

        it('should increment winner count', () => {
            state.incrementWinnerCount();
            expect(state.currentWinnerCount).toBe(1);
        });

        it('should reset winner count', () => {
            state.currentWinnerCount = 5;
            state.resetWinnerCount();
            expect(state.currentWinnerCount).toBe(0);
        });
    });

    describe('player management', () => {
        it('should add player to raffle', () => {
            state.addPlayerToRaffle('realm_character', 'twitch_user', 'ALLIANCE');
            
            expect(state.currentRaffleList).toContain('realm_character');
            expect(state.currentRaffleTwitchName).toContain('twitch_user');
            expect(state.playerFactionDictionary['realm_character']).toBe('ALLIANCE');
            expect(state.playerToTwitchNameDictionary['realm_character']).toBe('twitch_user');
        });

        it('should check if player is in raffle', () => {
            state.currentRaffleList = ['realm_character'];
            
            expect(state.isPlayerInRaffle('realm_character')).toBe(true);
            expect(state.isPlayerInRaffle('other_character')).toBe(false);
        });

        it('should check if twitch user is in raffle', () => {
            state.currentRaffleTwitchName = ['twitch_user'];
            
            expect(state.isTwitchUserInRaffle('twitch_user')).toBe(true);
            expect(state.isTwitchUserInRaffle('other_user')).toBe(false);
        });

        it('should remove player from raffle', () => {
            state.currentRaffleList = ['player1', 'player2', 'player3'];
            
            state.removePlayerFromRaffle('player2');
            
            expect(state.currentRaffleList).toEqual(['player1', 'player3']);
        });

        it('should get random player and remove from list', () => {
            state.currentRaffleList = ['player1', 'player2', 'player3'];
            
            const player = state.getRandomPlayer();
            
            expect(['player1', 'player2', 'player3']).toContain(player);
            expect(state.currentRaffleList).toHaveLength(2);
            expect(state.currentRaffleList).not.toContain(player);
        });

        it('should return null when no players available', () => {
            state.currentRaffleList = [];
            
            const player = state.getRandomPlayer();
            
            expect(player).toBeNull();
        });
    });

    describe('message feed management', () => {
        it('should set message feed enabled', () => {
            state.setMessageFeedEnabled(false);
            expect(state.isMessageFeedEnabled()).toBe(false);
            
            state.setMessageFeedEnabled(true);
            expect(state.isMessageFeedEnabled()).toBe(true);
        });
    });

    describe('getters', () => {
        it('should get raffle status', () => {
            state.isRaffleOpen = true;
            state.currentWinnerCount = 3;
            state.desiredWinnerCount = RAFFLE.DEFAULT_DESIRED_WINNER_COUNT;
            state.currentRaffleList = ['player1', 'player2'];
            
            const status = state.getRaffleStatus();
            
            expect(status).toEqual({
                isOpen: true,
                currentWinnerCount: 3,
                desiredWinnerCount: RAFFLE.DEFAULT_DESIRED_WINNER_COUNT,
                playerCount: 2
            });
        });

        it('should get player info', () => {
            state.playerFactionDictionary['realm_character'] = 'ALLIANCE';
            state.playerToTwitchNameDictionary['realm_character'] = 'twitch_user';
            
            const info = state.getPlayerInfo('realm_character');
            
            expect(info).toEqual({
                faction: 'ALLIANCE',
                twitchName: 'twitch_user'
            });
        });
    });
});

