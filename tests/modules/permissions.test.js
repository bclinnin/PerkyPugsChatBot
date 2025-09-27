const PermissionService = require('../../src/modules/permissions');

describe('PermissionService', () => {
    let permissionService;

    beforeEach(() => {
        permissionService = new PermissionService();
    });

    describe('doesUserHaveAdminPermissions', () => {
        it('should return true for broadcaster', () => {
            const tags = {
                badges: { broadcaster: '1' },
                mod: false
            };

            const result = permissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(true);
        });

        it('should return true for moderator', () => {
            const tags = {
                badges: {},
                mod: true
            };

            const result = permissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(true);
        });

        it('should return false for regular user', () => {
            const tags = {
                badges: {},
                mod: false
            };

            const result = permissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(false);
        });

        it('should return false for null tags', () => {
            const result = permissionService.doesUserHaveAdminPermissions(null);
            expect(result).toBe(false);
        });

        it('should return false for tags without badges', () => {
            const tags = {
                mod: false
            };

            const result = permissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(false);
        });

        it('should return true for user in custom mod list', () => {
            // Mock the environment variable
            const originalModList = process.env.MOD_LIST;
            process.env.MOD_LIST = 'moduser1,moduser2,moduser3';

            // Create new service instance with updated environment
            const testPermissionService = new PermissionService();

            const tags = {
                badges: {},
                mod: false,
                username: 'moduser2'
            };

            const result = testPermissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(true);

            // Restore original value
            process.env.MOD_LIST = originalModList;
        });

        it('should return true for user in custom mod list (case insensitive)', () => {
            // Mock the environment variable
            const originalModList = process.env.MOD_LIST;
            process.env.MOD_LIST = 'ModUser1,ModUser2,ModUser3';

            // Create new service instance with updated environment
            const testPermissionService = new PermissionService();

            const tags = {
                badges: {},
                mod: false,
                username: 'moduser2'
            };

            const result = testPermissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(true);

            // Restore original value
            process.env.MOD_LIST = originalModList;
        });

        it('should return false for user not in custom mod list', () => {
            // Mock the environment variable
            const originalModList = process.env.MOD_LIST;
            process.env.MOD_LIST = 'moduser1,moduser2,moduser3';

            // Create new service instance with updated environment
            const testPermissionService = new PermissionService();

            const tags = {
                badges: {},
                mod: false,
                username: 'regularuser'
            };

            const result = testPermissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(false);

            // Restore original value
            process.env.MOD_LIST = originalModList;
        });

        it('should return false when MOD_LIST is not set', () => {
            // Mock the environment variable
            const originalModList = process.env.MOD_LIST;
            delete process.env.MOD_LIST;

            // Create new service instance with updated environment
            const testPermissionService = new PermissionService();

            const tags = {
                badges: {},
                mod: false,
                username: 'moduser2'
            };

            const result = testPermissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(false);

            // Restore original value
            process.env.MOD_LIST = originalModList;
        });

        it('should handle MOD_LIST with spaces correctly', () => {
            // Mock the environment variable
            const originalModList = process.env.MOD_LIST;
            process.env.MOD_LIST = ' moduser1 , moduser2 , moduser3 ';

            // Create new service instance with updated environment
            const testPermissionService = new PermissionService();

            const tags = {
                badges: {},
                mod: false,
                username: 'moduser2'
            };

            const result = testPermissionService.doesUserHaveAdminPermissions(tags);
            expect(result).toBe(true);

            // Restore original value
            process.env.MOD_LIST = originalModList;
        });
    });

    describe('canTwitchAccountEnterInRaffle', () => {
        it('should return true for admin users', () => {
            const tags = { 
                username: 'admin_user',
                badges: { broadcaster: '1' },
                mod: false
            };
            const currentRaffleTwitchName = ['admin_user'];

            const result = permissionService.canTwitchAccountEnterInRaffle(tags, currentRaffleTwitchName);
            expect(result).toBe(true);
        });

        it('should return true for new users', () => {
            const tags = { 
                username: 'new_user',
                badges: {},
                mod: false
            };
            const currentRaffleTwitchName = ['other_user'];

            const result = permissionService.canTwitchAccountEnterInRaffle(tags, currentRaffleTwitchName);
            expect(result).toBe(true);
        });

        it('should return false for existing users (non-admin)', () => {
            const tags = { 
                username: 'existing_user',
                badges: {},
                mod: false
            };
            const currentRaffleTwitchName = ['existing_user'];

            const result = permissionService.canTwitchAccountEnterInRaffle(tags, currentRaffleTwitchName);
            expect(result).toBe(false);
        });

        it('should return true for admin even if already entered', () => {
            const tags = { 
                username: 'admin_user',
                badges: { broadcaster: '1' },
                mod: false
            };
            const currentRaffleTwitchName = ['admin_user'];

            const result = permissionService.canTwitchAccountEnterInRaffle(tags, currentRaffleTwitchName);
            expect(result).toBe(true);
        });
    });
});

