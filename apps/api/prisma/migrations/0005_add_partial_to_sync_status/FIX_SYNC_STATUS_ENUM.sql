-- Fix SyncStatus enum: Add PARTIAL value
-- This fixes the error: Invalid input value for enum "SyncStatus":"PARTIAL"
-- 
-- Run this SQL directly in your PostgreSQL database if Prisma migrate doesn't work
-- 
-- Usage:
--   psql -U qms_user -d qms -f FIX_SYNC_STATUS_ENUM.sql
--   OR
--   Connect to database and run: ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';

-- Check if PARTIAL already exists (optional - will fail gracefully if it does)
DO $$
BEGIN
    -- Try to add the value
    ALTER TYPE "SyncStatus" ADD VALUE 'PARTIAL';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'PARTIAL value already exists in SyncStatus enum';
END $$;
