const tmi = require('tmi.js');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { AXIOS_RETRY_CONFIG, HTTP_STATUS } = require('./constants');
require('dotenv').config();

// Import modules
const AuthService = require('./modules/auth');
const AppState = require('./modules/state');
const { MessageService } = require('./modules/messaging');
const PermissionService = require('./modules/permissions');
const WoWApiService = require('./modules/wowApi');
const DataAccessService = require('./modules/dataAccess');
const DiscordService = require('./modules/discord');
const RaffleService = require('./modules/raffle');
const CommandService = require('./modules/commands');

class PerkyPugsBot {
    constructor() {
        // Setup axios retry configuration (no dependencies)
        this.setupAxiosRetry();
    }

    async initialize() {
        // Initialize services in dependency order
        // Each step waits for the previous to complete before proceeding
        
        // Step 1: Core services with no dependencies
        this.authService = new AuthService();
        this.state = new AppState();
        this.permissionService = new PermissionService();
        
        // Step 2: Twitch client (depends on env vars only)
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
        
        // Step 3: Services that depend on authService
        this.wowApiService = new WoWApiService(this.authService);
        
        // Step 4: Database service (async - must complete before dependent services)
        this.dataAccessService = new DataAccessService();
        await this.dataAccessService.startup();
        
        // Step 4.5: Message service (depends on dataAccessService for canned messages)
        this.messageService = new MessageService(this.twitchClient, this.state.channel, true, this.dataAccessService);
        await this.messageService.loadCannedMessagesFromDatabase();
        
        // Step 4.5: Discord service (no dependencies)
        this.discordService = new DiscordService(process.env.DISCORD_WEBHOOK_URL);
        
        // Step 5: Services that depend on dataAccessService
        this.raffleService = new RaffleService(
            this.state, 
            this.messageService, 
            this.wowApiService, 
            this.permissionService, 
            this.dataAccessService,
            this.discordService
        );
        
        // Step 6: Command service (depends on raffleService)
        this.commandService = new CommandService(
            this.state, 
            this.messageService, 
            this.raffleService, 
            this.permissionService
        );
        
        // Step 7: Connect to Twitch and setup message handlers (depends on commandService)
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
        this.dataAccessService = null;
        this.state = null;
        this.twitchClient = null;
    }
}

// Only start the bot if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
    // Start the bot
    const bot = new PerkyPugsBot();
    bot.initialize().then(() => {
        bot.start();
    }).catch((error) => {
        console.error('Failed to initialize bot:', error);
        process.exit(1);
    });

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

