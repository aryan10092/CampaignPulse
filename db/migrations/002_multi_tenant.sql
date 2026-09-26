-- Migration: Multi-tenant user support
-- Run this against your NeonDB database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Per-user email settings (replaces global app_settings for credentials)
CREATE TABLE IF NOT EXISTS user_email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'simulation',
    smtp_user VARCHAR(255) DEFAULT '',
    smtp_pass TEXT DEFAULT '',          -- encrypted
    resend_api_key TEXT DEFAULT '',     -- encrypted
    from_email VARCHAR(255) DEFAULT '',
    from_name VARCHAR(255) DEFAULT 'CampaignPulse',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Add user_id column to campaigns (nullable for backward compat)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for per-user campaign queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_settings_user_id ON user_email_settings(user_id);
