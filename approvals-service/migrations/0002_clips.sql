-- spec/phases/round-2-approvals-video.md "Contract and data changes": a variant's kind and its
-- clip. Rows from before this file read as images with no clip.
ALTER TABLE gallery_variant ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';
ALTER TABLE gallery_variant ADD COLUMN clip_url TEXT;
ALTER TABLE gallery_variant ADD COLUMN clip_ms INTEGER;
ALTER TABLE gallery_variant ADD COLUMN clip_bytes INTEGER;
