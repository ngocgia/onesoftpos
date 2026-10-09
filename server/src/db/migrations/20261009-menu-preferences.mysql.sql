-- Upgrade an existing MySQL database. No seed data or destructive statements.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS menu_preferences (
    owner_type VARCHAR(10) NOT NULL,
    owner_id INTEGER NOT NULL,
    section VARCHAR(32) NOT NULL,
    payload TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_type, owner_id, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
