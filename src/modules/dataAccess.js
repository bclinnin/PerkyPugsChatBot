const {Client} = require('pg');

class DataAccessService {
    constructor() {
        this.client = null;
        this.previousWinnersByTwitchName = {};
        this.previousWinnersByRealmCharacterCombo = {};
    }

    getDatabaseClient() {
        if (process.env.CURRENT_ENVIRONMENT === 'local') {
            return new Client({
                connectionString: process.env.DATABASE_URL
            });
        } else {
            return new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            });
        }
    }

    async startup() {
        console.log('Caching database');
        console.log(process.env.DATABASE_URL);

        this.client = this.getDatabaseClient();
        try {
            await this.client.connect();
            const result = await this.client.query('select * from dimensiuswinners');
            this.populateGlobalLookups(result);
            console.log('Database caching complete');
        } catch (error) {
            console.error('Error during database startup:', error);
            throw error;
        }
    }

    populateGlobalLookups(result) {
        console.log(`re-caching ${result.rowCount} rows`);
        for (const idx in result.rows) {
            const currentTwitchName = result.rows[idx].twitchname;
            const currentRealmCharacterCombo = result.rows[idx].realmcharactercombo;
            this.addNameToTwitchWinnersList(currentTwitchName);
            this.addNameToCharacterWinnersList(currentRealmCharacterCombo);
        }
    }

    addNameToTwitchWinnersList(name) {
        if (name in this.previousWinnersByTwitchName) {
            this.previousWinnersByTwitchName[name] += 1;
        } else {
            this.previousWinnersByTwitchName[name] = 1;
        }
    }

    addNameToCharacterWinnersList(character) {
        if (character in this.previousWinnersByRealmCharacterCombo) {
            this.previousWinnersByRealmCharacterCombo[character] += 1;
        } else {
            this.previousWinnersByRealmCharacterCombo[character] = 1;
        }
    }

    async persistNewWinner(twitchName, realm, characterName, combo) {
        try {
            const myquery = 'INSERT INTO dimensiuswinners (twitchname,realm,charactername,realmcharactercombo) VALUES ($1,$2,$3,$4)';
            const values = [twitchName, realm, characterName, combo];
            console.log(myquery);
            await this.client.query(myquery, values);
        } catch (error) {
            console.log(`Failed to persist winner ${combo}:`, error);
            throw error;
        }
    }

    getPreviousWinnersByTwitchName() {
        return this.previousWinnersByTwitchName;
    }

    getPreviousWinnersByRealmCharacterCombo() {
        return this.previousWinnersByRealmCharacterCombo;
    }

    hasWonByTwitchName(twitchName) {
        return twitchName in this.previousWinnersByTwitchName;
    }

    hasWonByCharacter(character) {
        return character in this.previousWinnersByRealmCharacterCombo;
    }

    async loadCannedMessages() {
        try {
            const result = await this.client.query(
                'SELECT messagetext FROM cannedmessages WHERE enabled = true ORDER BY displayorder ASC'
            );
            return result.rows.map(row => row.messagetext);
        } catch (error) {
            console.error('Error loading canned messages:', error);
            return [];
        }
    }
}

module.exports = DataAccessService;

