-- Schema for the Dimensius (Manaforge Omega) season winners table
-- This table tracks winners for the current World of Warcraft season

CREATE TABLE dimensiuswinners (
    winid uuid DEFAULT gen_random_uuid(),
    twitchname character varying NOT NULL,
    realm character varying NOT NULL,
    charactername character varying NOT NULL,
    realmcharactercombo character varying NOT NULL,
    windate timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
-- Index on twitchname for quick lookups
CREATE INDEX idx_dimensiuswinners_twitchname ON dimensiuswinners(twitchname);

-- Index on realmcharactercombo for quick lookups
CREATE INDEX idx_dimensiuswinners_realmcharactercombo ON dimensiuswinners(realmcharactercombo);

