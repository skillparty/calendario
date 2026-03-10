-- Migration 008 v3: Groups & Collaborative Calendar
-- Supabase-compatible: TEXT for all user references (no FK type conflicts)
-- IDEMPOTENT: drops partial tables from failed attempts before recreating

BEGIN;

-- ── Step 1: Clean up any partial state from previous failed runs ──────────────
-- Remove columns from tasks first (they reference groups FK)
ALTER TABLE tasks DROP COLUMN IF EXISTS group_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE tasks DROP COLUMN IF EXISTS task_status;

-- Drop tables in dependency order
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;

-- ── Step 2: Create groups table ───────────────────────────────────────────────
CREATE TABLE groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  owner_id    TEXT NOT NULL,          -- user ID string (integer or UUID)
  invite_code VARCHAR(12) UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 3: Create group_members table ───────────────────────────────────────
CREATE TABLE group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,            -- user ID string (integer or UUID)
  role      TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ── Step 4: Extend tasks table ────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  ADD COLUMN assigned_to TEXT,        -- user ID string, no FK (type flexibility)
  ADD COLUMN task_status TEXT DEFAULT 'todo'
    CHECK (task_status IN ('todo', 'in_progress', 'done', 'blocked'));

-- ── Step 5: Indexes ───────────────────────────────────────────────────────────
CREATE INDEX idx_groups_owner_id        ON groups(owner_id);
CREATE INDEX idx_group_members_user_id  ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_tasks_group_id         ON tasks(group_id);
CREATE INDEX idx_tasks_assigned_to      ON tasks(assigned_to);

-- ── Step 6: Trigger — auto-add owner as member on group creation ──────────────
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_add_owner_as_member ON groups;
CREATE TRIGGER trg_add_owner_as_member
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION add_owner_as_member();

-- ── Step 7: Trigger — generate random invite code ────────────────────────────
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invite_code ON groups;
CREATE TRIGGER trg_generate_invite_code
  BEFORE INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

COMMIT;
