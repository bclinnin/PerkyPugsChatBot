const tmi = require('tmi.js');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const dataAccess = require('../dataAccess');
const { AXIOS_RETRY_CONFIG, HTTP_STATUS } = require('./constants');
require('dotenv').config();

// Import modules
const AuthService = require('./modules/auth');
const AppState = require('./modules/state');
const { MessageService } = require('./modules/messaging');
const PermissionService = require('./modules/permissions');
const WoWApiService = require('./modules/wowApi');
const RaffleService = require('./modules/raffle');
const CommandService = require('./modules/commands');

class PerkyPugsBot {
    constructor() {
        this.setupDatabase();
        this.initializeServices();
        this.setupTwitchClient();
        this.setupAxiosRetry();
    }

    setupDatabase() {
        dataAccess.dbStartup();
    }

    initializeServices() {
        // Initialize core services
        this.authService = new AuthService();
        this.state = new AppState();
        this.permissionService = new PermissionService();
        
        // Initialize Twitch client
        this.twitchClient = new tmi.Client({
            connection: {
                reconnect: true
            },
            identity: {
                username: process.env.TWITCH_BOT_USERNAME,
                password: process.env.TWITCH_BOT_PASSWORD
            },
            channels: [process.env.TWITCH_CHANNEL_NAME]
        });

        // Initialize dependent services
        this.messageService = new MessageService(this.twitchClient, this.state.channel);
        this.wowApiService = new WoWApiService(this.authService);
        this.raffleService = new RaffleService(this.state, this.messageService, this.wowApiService, this.permissionService);
        this.commandService = new CommandService(this.state, this.messageService, this.raffleService, this.permissionService);
    }

    setupTwitchClient() {
        this.twitchClient.connect();
        this.setupMessageHandler();
    }

    setupAxiosRetry() {
        axiosRetry(axios, {
            retryDelay: (retryCount) => {
                return axiosRetry.exponentialDelay(retryCount);
            },
            retries: AXIOS_RETRY_CONFIG.RETRIES,
            shouldResetTimeout: AXIOS_RETRY_CONFIG.SHOULD_RESET_TIMEOUT,
            retryCondition: (error) => {
                if (error.response === undefined) {
                    console.log('Undefined response, retrying');
                    return true;
                }
                console.log('Retry condition status ' + error.response['status']);
                return ((error.response['status'] === HTTP_STATUS.TOO_MANY_REQUESTS) || (error.response['status'] === HTTP_STATUS.INTERNAL_SERVER_ERROR));
            }
        });
    }

    setupMessageHandler() {
        this.twitchClient.on('message', (channel, tags, message, self) => {
            try {
                if (self || !message.startsWith('!')) {
                    return;
                }

                const args = message.slice(1).trim().split(/\s+/);
                const command = args.shift().toLowerCase();

                // Route the command to the appropriate handler
                this.commandService.routeCommand(command, args, tags);
            } catch (err) {
                console.log('Outer command level error -', err);
            }
        });
    }

    start() {
        console.log('Perky Pugs Bot started successfully!');
    }

    shutdown() {
        return new Promise((resolve) => {
            // Comprehensive shutdown logic
            console.log('Shutting down bot...');
            
            // Shutdown message service first to stop sending messages
            if (this.messageService) {
                this.messageService.shutdown();
            }
            
            // Disconnect from Twitch - TMI.js disconnect() is synchronous
            if (this.twitchClient && typeof this.twitchClient.disconnect === 'function') {
                try {
                    this.twitchClient.disconnect();
                } catch (err) {
                    console.log('Error during disconnect:', err);
                }
            }
            
            // Give a small delay for cleanup, then resolve
            setTimeout(() => {
                this.cleanup();
                console.log('Bot shutdown complete');
                resolve();
            }, 100);
        });
    }

    cleanup() {
        // Clear references
        this.messageService = null;
        this.wowApiService = null;
        this.raffleService = null;
        this.commandService = null;
        this.authService = null;
        this.permissionService = null;
        this.state = null;
        this.twitchClient = null;
    }
}

// Only start the bot if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
    // Start the bot
    const bot = new PerkyPugsBot();
    bot.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        bot.shutdown().then(() => {
            // Force immediate exit to avoid batch job prompt
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        bot.shutdown().then(() => {
            // Force immediate exit to avoid batch job prompt
            process.exit(0);
        });
    });
}

module.exports = PerkyPugsBot;

