const axios = require('axios');
const { API, HTTP_STATUS } = require('../constants');
const { ERROR_MESSAGES } = require('../constants/messages');

class AuthService {
    constructor() {
        this.authToken = null;
        this.debug = process.env.DEBUG_MODE === 'true';
    }

    getAuthBody() {
        const details = {
            client_id: process.env.BLIZZARD_CLIENTID,
            client_secret: process.env.BLIZZARD_CLIENTSECRET,
            grant_type: 'client_credentials'
        };

        const formBody = [];
        for (const property in details) {
            const encodedKey = encodeURIComponent(property);
            const encodedValue = encodeURIComponent(details[property]);
            formBody.push(encodedKey + '=' + encodedValue);
        }
        return formBody.join('&');
    }

    async requestAuthToken() {
        // If we already have a token, return it
        if (this.authToken) {
            return this.authToken;
        }

        try {
            const formBody = this.getAuthBody();
            const response = await axios.post(API.BLIZZARD_AUTH_URL,
                formBody,
                {
                    headers: { 'content-type': API.CONTENT_TYPE },
                    timeout: process.env.API_TIMEOUT_MS
                }
            );

            return this.handleAuthResponse(response);
        } catch (error) {
            console.error('Failed to get auth token:', error);
            throw error;
        }
    }

    handleAuthResponse(response) {
        if (response.status === HTTP_STATUS.OK) {
            this.authToken = response.data.access_token;
            return response.data.access_token;
        } else {
            if (this.debug) {
                console.log('Failed to get an auth token from blizzard');
            }
            throw new Error(ERROR_MESSAGES.AUTH_FAILED);
        }
    }

    getToken() {
        return this.authToken;
    }

    clearToken() {
        this.authToken = null;
    }
}

module.exports = AuthService;

