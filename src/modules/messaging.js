const { MESSAGING, BUFFER_TYPES, MESSAGE_PRIORITY } = require('../constants');
const { BUFFER_MESSAGES, CANNED_MESSAGES } = require('../constants/messages');

class MessageService {
    constructor(twitchClient, channel, setupIntervals = true, dataAccessService = null) {
        this.client = twitchClient;
        this.channel = channel;
        this.dataAccessService = dataAccessService;
        this.timeWindowForThrottle = null;
        this.messagesInThrottleWindow = 0;
        this.messageBuffers = {
            [BUFFER_TYPES.SUCCESSFUL_ENTER]: [],
            [BUFFER_TYPES.ALREADY_ENTERED]: [],
            [BUFFER_TYPES.CAN_ONLY_ENTER_ONCE]: [],
            [BUFFER_TYPES.WRONG_NAME]: [],
            [BUFFER_TYPES.REMIX]: [],
            [BUFFER_TYPES.MAX_LEVEL]: [],
            [BUFFER_TYPES.CANNOT_ENTER]: []
        };
        this.cannedMessages = CANNED_MESSAGES;
        this.currentMessage = 0;
        this.intervals = [];
        if (setupIntervals) {
            this.setupIntervals();
        }
    }

    setupIntervals() {
        // Set up message buffer intervals
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.SUCCESSFUL_ENTER], BUFFER_MESSAGES.SUCCESSFUL_ENTER), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.ALREADY_ENTERED], BUFFER_MESSAGES.ALREADY_ENTERED), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.CAN_ONLY_ENTER_ONCE], BUFFER_MESSAGES.CAN_ONLY_ENTER_ONCE), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.WRONG_NAME], BUFFER_MESSAGES.WRONG_NAME), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.REMIX], BUFFER_MESSAGES.REMIX), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.MAX_LEVEL], BUFFER_MESSAGES.MAX_LEVEL), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.sendMessageBuffer(this.messageBuffers[BUFFER_TYPES.CANNOT_ENTER], BUFFER_MESSAGES.CANNOT_ENTER), MESSAGING.MESSAGE_BUFFER_INTERVAL_MS));
        this.intervals.push(setInterval(() => this.rotateCannedMessages(), MESSAGING.CANNED_MESSAGE_INTERVAL_MS));
    }

    canSendMessage(priorityLevel) {
        if (this.timeWindowForThrottle === null) {
            this.timeWindowForThrottle = new Date();
        }

        const currentTime = new Date();
        const diff = (currentTime.getTime() - this.timeWindowForThrottle.getTime()) / 1000;

        if (diff > MESSAGING.THROTTLE_WINDOW_SECONDS) {
            this.timeWindowForThrottle = currentTime;
            this.messagesInThrottleWindow = 0;
        }

        if (priorityLevel === MESSAGE_PRIORITY.High && this.messagesInThrottleWindow < MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT) {
            return true;
        }
        if (priorityLevel === MESSAGE_PRIORITY.Low && this.messagesInThrottleWindow < MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT) {
            return true;
        }
        return false;
    }

    sendMessage(priorityLevel, message) {
        if (!this.canSendMessage(priorityLevel)) {
            console.log('Turned away message with priority level of ' + priorityLevel + ' with message ' + message);
            return false;
        }

        this.messagesInThrottleWindow++;
        this.client.say(this.channel, message);
        console.log('Messages in current time window: ' + this.messagesInThrottleWindow);
        return true;
    }

    sendMessageBuffer(buffer, message) {
        if (buffer.length === 0) {return;}
        if (!this.canSendMessage(MESSAGE_PRIORITY.Low)) {return;}

        const usersPerMessage = MESSAGING.USERS_PER_MESSAGE;
        let count = 0;
        let userListString = '';

        while (buffer.length > 0 && count < usersPerMessage) {
            userListString += '@' + buffer.shift() + ' ';
            count++;
        }

        if (userListString !== '') {
            this.messagesInThrottleWindow++;
            this.client.say(this.channel, userListString + message);
            console.log('Messages in current time window: ' + this.messagesInThrottleWindow);
        }
    }

    rotateCannedMessages() {
        if (!this.canSendMessage(MESSAGE_PRIORITY.Low)) {return;}

        if (this.currentMessage > (this.cannedMessages.length - 1)) {
            this.currentMessage = 0;
        }

        this.client.say(this.channel, this.cannedMessages[this.currentMessage]);
        this.currentMessage++;
    }

    // Buffer management methods
    addToBuffer(bufferType, username) {
        if (this.messageBuffers[bufferType]) {
            this.messageBuffers[bufferType].push(username);
        }
    }

    // Convenience methods for common buffer operations
    addSuccessfulEnter(username) {
        this.addToBuffer(BUFFER_TYPES.SUCCESSFUL_ENTER, username);
    }

    addAlreadyEntered(username) {
        this.addToBuffer(BUFFER_TYPES.ALREADY_ENTERED, username);
    }

    addCanOnlyEnterOnce(username) {
        this.addToBuffer(BUFFER_TYPES.CAN_ONLY_ENTER_ONCE, username);
    }

    addWrongName(username) {
        this.addToBuffer(BUFFER_TYPES.WRONG_NAME, username);
    }

    addRemix(username) {
        this.addToBuffer(BUFFER_TYPES.REMIX, username);
    }

    addMaxLevel(username) {
        this.addToBuffer(BUFFER_TYPES.MAX_LEVEL, username);
    }

    addCannotEnter(username) {
        this.addToBuffer(BUFFER_TYPES.CANNOT_ENTER, username);
    }

    // Cleanup method to clear intervals (useful for testing)
    cleanup() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    shutdown() {
        // Comprehensive shutdown logic
        this.cleanup();
        
        // Clear any pending state
        this.messagesInThrottleWindow = 0;
        this.timeWindowForThrottle = null;
        this.currentMessage = 0;
        
        // Clear all buffers
        Object.keys(this.messageBuffers).forEach(key => {
            this.messageBuffers[key] = [];
        });
        
        // Clear client reference
        this.client = null;
    }

    async loadCannedMessagesFromDatabase() {
        if (!this.dataAccessService) {
            console.log('Using hardcoded canned messages (no database service)');
            return;
        }
        
        try {
            const messages = await this.dataAccessService.loadCannedMessages();
            if (messages && messages.length > 0) {
                this.cannedMessages = messages;
                console.log(`Loaded ${messages.length} canned messages from database`);
            } else {
                console.log('No messages in database, using defaults');
            }
        } catch (error) {
            console.error('Error loading canned messages from database:', error);
            console.log('Falling back to hardcoded messages');
        }
    }
}

module.exports = { MessageService };

