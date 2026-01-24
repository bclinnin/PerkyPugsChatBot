const axios = require('axios');

class DiscordService {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    async postWinnersToDiscord(winners) {
        // Skip if no webhook URL configured
        if (!this.webhookUrl) {
            console.log('Discord webhook URL not configured, skipping Discord post');
            return;
        }

        // Skip if no winners
        if (!winners || winners.length === 0) {
            console.log('No winners to post to Discord');
            return;
        }

        try {
            // Separate winners by faction
            const allianceWinners = winners.filter(w => w.faction === 'ALLIANCE');
            const hordeWinners = winners.filter(w => w.faction === 'HORDE');

            // Build the Discord embed
            const embed = {
                title: 'Raffle Winners - Ready for Invites!',
                color: 0x0099ff,
                fields: [],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Total Winners: ${winners.length}`
                }
            };

            // Add Alliance winners field if any exist
            if (allianceWinners.length > 0) {
                const allianceList = allianceWinners
                    .map(w => w.originalFormat)
                    .join('\n');
                
                embed.fields.push({
                    name: `🔵 Alliance Winners (${allianceWinners.length})`,
                    value: '```\n' + allianceList + '\n```',
                    inline: false
                });
            }

            // Add Horde winners field if any exist
            if (hordeWinners.length > 0) {
                const hordeList = hordeWinners
                    .map(w => w.originalFormat)
                    .join('\n');
                
                embed.fields.push({
                    name: `🔴 Horde Winners (${hordeWinners.length})`,
                    value: '```\n' + hordeList + '\n```',
                    inline: false
                });
            }

            // Send to Discord webhook
            const payload = {
                content: '📢 **Raffle Complete!**',
                embeds: [embed]
            };

            await axios.post(this.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log(`Successfully posted ${winners.length} winners to Discord`);
        } catch (error) {
            console.error('Error posting winners to Discord:', error.message);
            if (error.response) {
                console.error('Discord API response:', error.response.status, error.response.data);
            }
            // Don't throw - we don't want Discord errors to break the raffle system
        }
    }
}

module.exports = DiscordService;
