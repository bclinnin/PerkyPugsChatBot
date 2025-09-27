const { MessageService } = require('../../src/modules/messaging');
const { MESSAGE_PRIORITY } = require('../../src/constants');
const { MESSAGING, BUFFER_TYPES } = require('../../src/constants');

// Mock tmi.js client
const mockTwitchClient = {
    say: jest.fn()
};

describe('MessageService', () => {
    let messageService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        messageService = new MessageService(mockTwitchClient, 'test_channel', false);
    });

    afterEach(() => {
        jest.useRealTimers();
        // Clean up intervals to prevent Jest from hanging
        if (messageService) {
            messageService.shutdown();
        }
    });

    describe('canSendMessage', () => {
        it('should allow high priority messages when under limit', () => {
            messageService.messagesInThrottleWindow = MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT - 1;
            
            const result = messageService.canSendMessage(MESSAGE_PRIORITY.High);
            
            expect(result).toBe(true);
        });

        it('should reject high priority messages when over limit', () => {
            messageService.messagesInThrottleWindow = MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT + 1;
            
            const result = messageService.canSendMessage(MESSAGE_PRIORITY.High);
            
            expect(result).toBe(false);
        });

        it('should allow low priority messages when under limit', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT - 1;
            
            const result = messageService.canSendMessage(MESSAGE_PRIORITY.Low);
            
            expect(result).toBe(true);
        });

        it('should reject low priority messages when over limit', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT + 1;
            
            const result = messageService.canSendMessage(MESSAGE_PRIORITY.Low);
            
            expect(result).toBe(false);
        });

        it('should reset throttle window after 30 seconds', () => {
            messageService.messagesInThrottleWindow = MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT + 1;
            messageService.timeWindowForThrottle = new Date(Date.now() - (MESSAGING.THROTTLE_WINDOW_SECONDS + 1) * 1000);
            
            const result = messageService.canSendMessage(MESSAGE_PRIORITY.High);
            
            expect(result).toBe(true);
            expect(messageService.messagesInThrottleWindow).toBe(0);
        });
    });

    describe('sendMessage', () => {
        it('should send message when allowed', () => {
            messageService.messagesInThrottleWindow = MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT - 1;
            
            const result = messageService.sendMessage(MESSAGE_PRIORITY.High, 'Test message');
            
            expect(result).toBe(true);
            expect(mockTwitchClient.say).toHaveBeenCalledWith('test_channel', 'Test message');
            expect(messageService.messagesInThrottleWindow).toBe(MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT);
        });

        it('should not send message when throttled', () => {
            messageService.messagesInThrottleWindow = MESSAGING.HIGH_PRIORITY_MESSAGE_LIMIT + 1;
            
            const result = messageService.sendMessage(MESSAGE_PRIORITY.High, 'Test message');
            
            expect(result).toBe(false);
            expect(mockTwitchClient.say).not.toHaveBeenCalled();
        });
    });

    describe('sendMessageBuffer', () => {
        it('should send buffered messages', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT - 1;
            const buffer = ['user1', 'user2', 'user3'];
            
            messageService.sendMessageBuffer(buffer, ' test message');
            
            expect(mockTwitchClient.say).toHaveBeenCalledWith('test_channel', '@user1 @user2 @user3  test message');
            expect(buffer).toHaveLength(0);
        });

        it('should not send when throttled', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT + 1;
            const buffer = ['user1', 'user2'];
            
            messageService.sendMessageBuffer(buffer, ' test message');
            
            expect(mockTwitchClient.say).not.toHaveBeenCalled();
            expect(buffer).toHaveLength(2);
        });

        it('should handle empty buffer', () => {
            const buffer = [];
            
            messageService.sendMessageBuffer(buffer, ' test message');
            
            expect(mockTwitchClient.say).not.toHaveBeenCalled();
        });
    });

    describe('buffer management', () => {
        it('should add users to specific buffers', () => {
            messageService.addSuccessfulEnter('user1');
            messageService.addAlreadyEntered('user2');
            messageService.addWrongName('user3');
            
            expect(messageService.messageBuffers[BUFFER_TYPES.SUCCESSFUL_ENTER]).toContain('user1');
            expect(messageService.messageBuffers[BUFFER_TYPES.ALREADY_ENTERED]).toContain('user2');
            expect(messageService.messageBuffers[BUFFER_TYPES.WRONG_NAME]).toContain('user3');
        });
    });

    describe('rotateCannedMessages', () => {
        it('should send canned messages in rotation', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT - 1;
            
            messageService.rotateCannedMessages();
            
            expect(mockTwitchClient.say).toHaveBeenCalledWith('test_channel', messageService.cannedMessages[0]);
            expect(messageService.currentMessage).toBe(1);
        });

        it('should reset to first message after last', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT - 1;
            messageService.currentMessage = messageService.cannedMessages.length;
            
            messageService.rotateCannedMessages();
            
            expect(messageService.currentMessage).toBe(1);
        });

        it('should not send when throttled', () => {
            messageService.messagesInThrottleWindow = MESSAGING.LOW_PRIORITY_MESSAGE_LIMIT + 1;
            
            messageService.rotateCannedMessages();
            
            expect(mockTwitchClient.say).not.toHaveBeenCalled();
        });
    });
});

