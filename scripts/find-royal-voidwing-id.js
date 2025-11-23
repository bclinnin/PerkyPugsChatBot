const axios = require('axios');
require('dotenv').config();

// Script to find the mount ID for Royal Voidwing by querying a character that has it

async function findRoyalVoidwingId() {
    console.log('Searching for Royal Voidwing mount ID...\n');
    
    // Check if we have credentials
    if (!process.env.BLIZZARD_CLIENTID || !process.env.BLIZZARD_CLIENTSECRET) {
        console.error('Error: BLIZZARD_CLIENTID and BLIZZARD_CLIENTSECRET must be set in .env file');
        return;
    }

    const realm = 'thrall';
    const character = 'xtrimity';

    try {
        // Get OAuth token
        console.log('Getting OAuth token...');
        const authResponse = await axios.post('https://us.battle.net/oauth/token', 
            new URLSearchParams({
                grant_type: 'client_credentials'
            }),
            {
                auth: {
                    username: process.env.BLIZZARD_CLIENTID,
                    password: process.env.BLIZZARD_CLIENTSECRET
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const token = authResponse.data.access_token;
        console.log('✓ OAuth token obtained\n');

        // Fetch character's mount collection
        console.log(`Fetching mount collection for ${character}-${realm}...`);
        const mountResponse = await axios.get(
            `https://us.api.blizzard.com/profile/wow/character/${realm}/${character}/collections/mounts`,
            {
                params: {
                    namespace: 'profile-us',
                    locale: 'en_US'
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log(`✓ Found ${mountResponse.data.mounts.length} mounts in collection\n`);
        console.log('Searching for "Royal Voidwing"...\n');

        // Search for Royal Voidwing
        const searchTerm = 'royal voidwing';
        const matchingMounts = mountResponse.data.mounts.filter(mount => {
            const name = mount.mount.name.toLowerCase();
            return name.includes(searchTerm) || (name.includes('royal') && name.includes('voidwing'));
        });

        if (matchingMounts.length > 0) {
            console.log('✓ Found Royal Voidwing!');
            console.log('='.repeat(60));
            matchingMounts.forEach(mount => {
                console.log(`\nMount Name: ${mount.mount.name}`);
                console.log(`Mount ID: ${mount.mount.id}`);
            });
            console.log('='.repeat(60));
            
            const mountId = matchingMounts[0].mount.id;
            console.log(`\n✓ Mount ID for Royal Voidwing: ${mountId}`);
            console.log(`\nAdd this to your .env file:`);
            console.log(`AOTC_MOUNT_ID=${mountId}`);
        } else {
            console.log('Royal Voidwing not found in mount collection.');
            console.log('\nSearching for mounts containing "voidwing"...\n');
            
            // Try searching for variations
            const voidwingMounts = mountResponse.data.mounts.filter(mount => 
                mount.mount.name.toLowerCase().includes('voidwing')
            );
            
            if (voidwingMounts.length > 0) {
                console.log('Found mounts containing "voidwing":');
                voidwingMounts.forEach(mount => {
                    console.log(`  ID: ${mount.mount.id} - ${mount.mount.name}`);
                });
            } else {
                console.log('No mounts containing "voidwing" found.');
                console.log('\nSearching for mounts containing "royal"...\n');
                
                const royalMounts = mountResponse.data.mounts.filter(mount => 
                    mount.mount.name.toLowerCase().includes('royal')
                );
                
                if (royalMounts.length > 0) {
                    console.log('Found mounts containing "royal":');
                    royalMounts.forEach(mount => {
                        console.log(`  ID: ${mount.mount.id} - ${mount.mount.name}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

findRoyalVoidwingId();

