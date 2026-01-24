CREATE TABLE IF NOT EXISTS cannedmessages (
    messageid SERIAL PRIMARY KEY,
    messagetext TEXT NOT NULL,
    displayorder INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    createdat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cannedmessages_enabled_order ON cannedmessages(enabled, displayorder);

-- Seed with existing default messages
INSERT INTO cannedmessages (messagetext, displayorder) VALUES
    ('When the raffle is open, type !enter name-realm. Please include any special characters - the bot will @ you to tell you that your character hasn''t been found, or that you had an error.', 1),
    ('No, there is no bad luck protection.', 2),
    ('Like what we''re doing? Donate to our campaign to raise money for The Global FoodBanking Network! https://tiltify.com/@perkypugs/perky-pugs-friendship-voidwing-20-fundraiser', 3),
    ('Interested in learning more about Perky Pugs? Join our Discord! Discord.gg/PerkyPugs', 4),
    ('If you are having trouble entering the raffle, please see the #friendship-dragon-carries channel in the Perky Pugs Discord or DM the Modmail bot for more detailed help. Discord.gg/PerkyPugs', 5)
ON CONFLICT DO NOTHING;
