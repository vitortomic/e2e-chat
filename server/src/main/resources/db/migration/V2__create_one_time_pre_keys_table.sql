-- One-time pre-keys table for forward secrecy (consumed after use)
CREATE TABLE IF NOT EXISTS one_time_pre_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL,
    key_data TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_one_time_pre_keys_user_id ON one_time_pre_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_one_time_pre_keys_used ON one_time_pre_keys(used);
CREATE INDEX IF NOT EXISTS idx_one_time_pre_keys_key_id ON one_time_pre_keys(key_id);
