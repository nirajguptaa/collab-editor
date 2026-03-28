-- ─────────────────────────────────────────────────────────────────────────────
-- Collab Editor — PostgreSQL Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users -----------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(32)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  avatar_color  VARCHAR(7)   NOT NULL DEFAULT '#6366f1', -- random on signup
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Refresh tokens (one per device) ---------------------------------------------
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms -----------------------------------------------------------------------
CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(12)  NOT NULL UNIQUE, -- short shareable ID, e.g. "xK9mPq"
  language    VARCHAR(32)  NOT NULL DEFAULT 'javascript',
  owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Room members ----------------------------------------------------------------
CREATE TABLE room_members (
  room_id  UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     VARCHAR(16) NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'viewer'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Documents (one per room, stores current snapshot) ---------------------------
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  revision    INTEGER NOT NULL DEFAULT 0, -- increments with every applied op
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operations log (for OT replay) ----------------------------------------------
CREATE TABLE operations (
  id          BIGSERIAL PRIMARY KEY,
  room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision    INTEGER     NOT NULL, -- server revision this op was applied at
  op_type     VARCHAR(16) NOT NULL, -- 'insert' | 'delete' | 'retain'
  position    INTEGER     NOT NULL,
  chars       TEXT,                 -- content for insert ops
  length      INTEGER,              -- length for delete ops
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_room_revision ON operations(room_id, revision);

-- Room activity log -----------------------------------------------------------
CREATE TABLE room_activity (
  id         BIGSERIAL PRIMARY KEY,
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  event      VARCHAR(32) NOT NULL, -- 'joined' | 'left' | 'snapshot'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: keep updated_at fresh ----------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rooms_updated_at   BEFORE UPDATE ON rooms   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
