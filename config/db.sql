CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    token_vk TEXT,
    group_id_vk TEXT,
    telegram_id TEXT,
    telegram_chat TEXT,
    last_post_date TEXT
);

CREATE TABLE access(
    id SERIAL PRIMARY KEY,
    telegram_nickname TEXT,
    date_access TEXT
);