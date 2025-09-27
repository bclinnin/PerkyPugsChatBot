const { COMMANDS, URLS, MESSAGE_PRIORITY } = require('../constants');
const { HELP_MESSAGE } = require('../constants/messages');

class CommandService {
    constructor(state, messageService, raffleService, permissionService) {
        this.state = state;
        this.messageService = messageService;
        this.raffleService = raffleService;
        this.permissionService = permissionService;
    }

    handleHelpCommand(_args, _tags) {
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, HELP_MESSAGE);
    }

    handleEchoCommand(args, tags) {
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${tags.username}, you said: "${args.join(' ')}"`);
    }

    handleCloseRaffleCommand(_args, _tags) {
        // Check if raffle is already closed
        if (!this.state.isRaffleOpen) {
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'The raffle is already closed');
            return;
        }
        this.state.closeRaffle();
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'The raffle is now closed');
    }

    handleOpenRaffleCommand(_args, _tags) {
        // Check if raffle is already open
        if (this.state.isRaffleOpen) {
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'The raffle is already open');
            return;
        }
        this.state.openRaffle();
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, 'The raffle is now open');
    }

    handleSetWinnersCommand(args, tags) {
        if (args.length !== 1) {
            console.log('Incorrect args sent to setwinners command');
            this.messageService.sendMessage(MESSAGE_PRIORITY.High, `@${tags.username}, please provide only one argument to the setwinners command. ex: "!setwinners 15"`);
            return;
        }
        const winnerCount = parseInt(args[0]);
        this.state.setDesiredWinnerCount(winnerCount);
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, `${winnerCount} players will be able to win in the next raffle!`);
    }

    handleApplyCommand(_args, _tags) {
        this.messageService.sendMessage(MESSAGE_PRIORITY.Low, `Carrier Application: ${URLS.CARRIER_APPLICATION}`);
    }

    toggleFeed(enableOrDisable, _tags) {
        this.state.setMessageFeedEnabled(enableOrDisable);
        this.messageService.sendMessage(MESSAGE_PRIORITY.High, `messageFeed set to ${enableOrDisable}`);
    }

    async handleEnterCommand(args, tags) {
        return this.raffleService.handleEnterCommand(args, tags);
    }

    async handleGetWinnersCommand(args, tags) {
        if (this.state.isRaffleOpen) {return;}
        this.state.resetWinnerCount();
        return this.raffleService.handleGetWinnersCommand(args, tags);
    }

    // Command router
    async routeCommand(command, args, tags) {
        try {
            if (!args || !tags) {return;}

            // Admin-only commands
            const adminCommands = [
                COMMANDS.ECHO, COMMANDS.SET_WINNERS, COMMANDS.OPEN_RAFFLE, 
                COMMANDS.CLOSE_RAFFLE, COMMANDS.GET_WINNERS, COMMANDS.HELP, 
                COMMANDS.APPLY, COMMANDS.ENABLE_FEED, COMMANDS.DISABLE_FEED
            ];

            if (adminCommands.includes(command) && !this.permissionService.doesUserHaveAdminPermissions(tags)) {
                return;
            }

            switch (command) {
            case COMMANDS.ECHO:
                this.handleEchoCommand(args, tags);
                break;
            case COMMANDS.SET_WINNERS:
                this.handleSetWinnersCommand(args, tags);
                break;
            case COMMANDS.ENTER:
                await this.handleEnterCommand(args, tags);
                break;
            case COMMANDS.OPEN_RAFFLE:
                this.handleOpenRaffleCommand(args, tags);
                break;
            case COMMANDS.CLOSE_RAFFLE:
                this.handleCloseRaffleCommand(args, tags);
                break;
            case COMMANDS.GET_WINNERS:
                await this.handleGetWinnersCommand(args, tags);
                break;
            case COMMANDS.HELP:
                this.handleHelpCommand(args, tags);
                break;
            case COMMANDS.APPLY:
                this.handleApplyCommand(args, tags);
                break;
            case COMMANDS.ENABLE_FEED:
                this.toggleFeed(true, tags);
                break;
            case COMMANDS.DISABLE_FEED:
                this.toggleFeed(false, tags);
                break;
            default:
                break;
            }
        } catch (err) {
            console.log('Command level error - ' + err);
        }
    }
}

module.exports = CommandService;

