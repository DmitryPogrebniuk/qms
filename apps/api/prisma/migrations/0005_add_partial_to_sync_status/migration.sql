-- AlterEnum
-- Add PARTIAL value to SyncStatus enum
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE
-- If the value already exists, this will fail - that's OK, just run the migration
ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';
