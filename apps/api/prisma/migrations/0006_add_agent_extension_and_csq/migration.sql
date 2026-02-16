-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "extension" VARCHAR(50);

-- CreateTable
CREATE TABLE "ContactServiceQueue" (
    "id" TEXT NOT NULL,
    "csqId" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mediaType" VARCHAR(50),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ContactServiceQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactServiceQueue_csqId_key" ON "ContactServiceQueue"("csqId");

-- CreateIndex
CREATE INDEX "Agent_extension_idx" ON "Agent"("extension");
