class PermissionService {
    constructor() {
        this.modList = process.env.MOD_LIST;
    }

    doesUserHaveAdminPermissions(tags) {
        if (!tags) {return false;}
        if (!tags.badges) {return false;}

        // Check if user is the broadcaster (streamer)
        if ('broadcaster' in tags.badges) {
            return true;
        }

        // Check if user is a moderator
        if (tags.mod === true) {
            return true;
        }

        // Check if user is in the custom mod list
        if (this.modList && tags.username) {
            const modListArray = this.modList.split(',').map(name => name.trim().toLowerCase());
            if (modListArray.includes(tags.username.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    canTwitchAccountEnterInRaffle(tags, currentRaffleTwitchName) {
        // Check if user is an admin
        const isAdmin = this.doesUserHaveAdminPermissions(tags);
        
        // Admins can enter multiple characters from a single twitch user
        if (isAdmin) {
            return true;
        }

        // Everyone else can only enter one character per twitch user
        return !currentRaffleTwitchName.includes(tags.username);
    }
}

module.exports = PermissionService;

