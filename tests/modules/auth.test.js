const AuthService = require('../../src/modules/auth');
const { API, HTTP_STATUS } = require('../../src/constants');
const { ERROR_MESSAGES } = require('../../src/constants/messages');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('AuthService', () => {
    let authService;

    beforeEach(() => {
        authService = new AuthService();
        jest.clearAllMocks();
    });

    describe('getAuthBody', () => {
        it('should return properly formatted form body', () => {
            // Mock environment variables
            process.env.BLIZZARD_CLIENTID = 'test_client_id';
            process.env.BLIZZARD_CLIENTSECRET = 'test_client_secret';

            const result = authService.getAuthBody();
            
            expect(result).toContain('client_id=test_client_id');
            expect(result).toContain('client_secret=test_client_secret');
            expect(result).toContain('grant_type=client_credentials');
        });
    });

    describe('requestAuthToken', () => {
        it('should return existing token if available', async () => {
            authService.authToken = 'existing_token';
            
            const result = await authService.requestAuthToken();
            
            expect(result).toBe('existing_token');
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should request new token if none exists', async () => {
            const mockResponse = {
                status: HTTP_STATUS.OK,
                data: { access_token: 'new_token' }
            };
            axios.post.mockResolvedValue(mockResponse);

            const result = await authService.requestAuthToken();
            
            expect(result).toBe('new_token');
            expect(authService.authToken).toBe('new_token');
            expect(axios.post).toHaveBeenCalledWith(
                API.BLIZZARD_AUTH_URL,
                expect.any(String),
                expect.objectContaining({
                    headers: { 'content-type': API.CONTENT_TYPE }
                })
            );
        });

        it('should handle authentication failure', async () => {
            const mockResponse = {
                status: 401, // Using hardcoded 401 since it's a test-specific error status
                data: { error: 'invalid_client' }
            };
            axios.post.mockResolvedValue(mockResponse);

            await expect(authService.requestAuthToken()).rejects.toThrow(ERROR_MESSAGES.AUTH_FAILED);
        });

        it('should handle network errors', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            await expect(authService.requestAuthToken()).rejects.toThrow('Network error');
        });
    });

    describe('handleAuthResponse', () => {
        it('should return token for successful response', () => {
            const response = {
                status: HTTP_STATUS.OK,
                data: { access_token: 'test_token' }
            };

            const result = authService.handleAuthResponse(response);
            
            expect(result).toBe('test_token');
            expect(authService.authToken).toBe('test_token');
        });

        it('should throw error for failed response', () => {
            const response = {
                status: 401, // Using hardcoded 401 since it's a test-specific error status
                data: { error: 'invalid_client' }
            };

            expect(() => authService.handleAuthResponse(response)).toThrow(ERROR_MESSAGES.AUTH_FAILED);
        });
    });

    describe('getToken', () => {
        it('should return current token', () => {
            authService.authToken = 'test_token';
            expect(authService.getToken()).toBe('test_token');
        });
    });

    describe('clearToken', () => {
        it('should clear the current token', () => {
            authService.authToken = 'test_token';
            authService.clearToken();
            expect(authService.authToken).toBeNull();
        });
    });
});

