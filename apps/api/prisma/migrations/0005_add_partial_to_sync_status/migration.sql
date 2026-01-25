-- AlterEnum
-- Add PARTIAL value to SyncStatus enum
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE
-- This migration uses DO block to handle the case when PARTIAL already exists
DO $$
BEGIN
    -- Check if PARTIAL already exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'PARTIAL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SyncStatus')
    ) THEN
        ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';
    END IF;
END $$;
