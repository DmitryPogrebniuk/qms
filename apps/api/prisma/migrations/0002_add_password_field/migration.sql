-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- Make keycloakId nullable since we'll support local auth
ALTER TABLE "User" ALTER COLUMN "keycloakId" DROP NOT NULL;
