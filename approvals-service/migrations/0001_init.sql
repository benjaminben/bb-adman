-- spec/approvals-service.md "Database (D1)". Times are whole milliseconds since 1970 (UTC).
-- No foreign keys: deletes are written out in one batch, children first.

CREATE TABLE link (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  project_id           TEXT NOT NULL,
  campaign_id          TEXT NOT NULL,
  campaign_name        TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  password_salt        TEXT NOT NULL,
  password_iterations  INTEGER NOT NULL,
  tries                INTEGER NOT NULL DEFAULT 0,
  tries_since          INTEGER,
  created_at           INTEGER NOT NULL,
  UNIQUE (project_id, campaign_id)
);

CREATE TABLE gallery_variant (
  link_id             TEXT NOT NULL,
  variant_key         TEXT NOT NULL,
  position            INTEGER NOT NULL,
  title               TEXT NOT NULL,
  size_line           TEXT NOT NULL,
  version             INTEGER NOT NULL,
  picture_url         TEXT NOT NULL,
  picture_expires_at  INTEGER NOT NULL,
  PRIMARY KEY (link_id, variant_key)
);

CREATE TABLE signoff (
  id           TEXT PRIMARY KEY,
  link_id      TEXT NOT NULL,
  variant_key  TEXT NOT NULL,
  version      INTEGER NOT NULL,
  email        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (link_id, variant_key, version, email)
);
CREATE INDEX signoff_link ON signoff (link_id);

CREATE TABLE session (
  token_hash  TEXT PRIMARY KEY,
  link_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX session_link ON session (link_id);
