/*
  Warnings:

  - The primary key for the `_prisma_migrations` table will be changed. If it partially fails, the migration will not be able to be rolled back by Prisma.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'QA', 'SUPERVISOR', 'USER');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'DISPUTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CoachingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SamplingPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'SEARCH', 'RECORD_VIEW', 'PLAYBACK_START', 'EVALUATION_CREATED', 'COACHING_CREATED', 'EVALUATION_SUBMITTED', 'DISPUTE_FILED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "keycloakId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" VARCHAR(255),
    "fullName" VARCHAR(255),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "agentId" VARCHAR(100),
    "teamCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "teamCode" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "supervisorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "agentId" VARCHAR(100) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTeam" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "AgentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "skillId" VARCHAR(100) NOT NULL,
    "skillName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "mediasenseRecordingId" VARCHAR(255) NOT NULL,
    "agentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "contactId" VARCHAR(100),
    "callId" VARCHAR(100),
    "direction" VARCHAR(20) NOT NULL,
    "ani" VARCHAR(50),
    "dnis" VARCHAR(50),
    "csq" VARCHAR(100),
    "wrapUpReason" VARCHAR(100),
    "transferCount" INTEGER DEFAULT 0,
    "holdTimeSeconds" INTEGER DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "contactId" VARCHAR(100),
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT,
    "chatId" TEXT,
    "scorecardTemplateId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "responses" JSONB NOT NULL,
    "totalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationBookmark" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "recordingId" TEXT,
    "timestamp" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolutionComment" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingPlan" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "actionItems" JSONB NOT NULL,
    "followUpEvaluationId" TEXT,
    "status" "CoachingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplingRule" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "samplePercentage" INTEGER NOT NULL,
    "period" "SamplingPeriod" NOT NULL,
    "criteria" JSONB NOT NULL,
    "assignedQAs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "teamCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamplingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplingRecord" (
    "id" TEXT NOT NULL,
    "samplingRuleId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedToQA" TEXT,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SamplingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAgentStats" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "callsHandled" INTEGER NOT NULL,
    "avgHandleTime" DOUBLE PRECISION NOT NULL,
    "holdTime" DOUBLE PRECISION NOT NULL,
    "transfers" INTEGER NOT NULL,
    "wrapUpCounts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAgentStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTeamStats" (
    "id" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCallsHandled" INTEGER NOT NULL,
    "avgHandleTime" DOUBLE PRECISION NOT NULL,
    "avgHoldTime" DOUBLE PRECISION NOT NULL,
    "totalTransfers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTeamStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "Role" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resourceId" TEXT,
    "filters" JSONB,
    "ipAddress" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "syncType" VARCHAR(100) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "watermark" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_agentId_key" ON "User"("agentId");

-- CreateIndex
CREATE INDEX "User_keycloakId_idx" ON "User"("keycloakId");

-- CreateIndex
CREATE INDEX "User_agentId_idx" ON "User"("agentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamCode_key" ON "Team"("teamCode");

-- CreateIndex
CREATE INDEX "Team_teamCode_idx" ON "Team"("teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_agentId_key" ON "Agent"("agentId");

-- CreateIndex
CREATE INDEX "Agent_agentId_idx" ON "Agent"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTeam_agentId_teamId_key" ON "AgentTeam"("agentId", "teamId");

-- CreateIndex
CREATE INDEX "AgentTeam_agentId_idx" ON "AgentTeam"("agentId");

-- CreateIndex
CREATE INDEX "AgentTeam_teamId_idx" ON "AgentTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_skillId_key" ON "Skill"("skillId");

-- CreateIndex
CREATE INDEX "Skill_skillId_idx" ON "Skill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_agentId_skillId_key" ON "AgentSkill"("agentId", "skillId");

-- CreateIndex
CREATE INDEX "AgentSkill_agentId_idx" ON "AgentSkill"("agentId");

-- CreateIndex
CREATE INDEX "AgentSkill_skillId_idx" ON "AgentSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_mediasenseRecordingId_key" ON "Recording"("mediasenseRecordingId");

-- CreateIndex
CREATE INDEX "Recording_agentId_idx" ON "Recording"("agentId");

-- CreateIndex
CREATE INDEX "Recording_teamCode_idx" ON "Recording"("teamCode");

-- CreateIndex
CREATE INDEX "Recording_startTime_idx" ON "Recording"("startTime");

-- CreateIndex
CREATE INDEX "Recording_mediasenseRecordingId_idx" ON "Recording"("mediasenseRecordingId");

-- CreateIndex
CREATE INDEX "Recording_contactId_idx" ON "Recording"("contactId");

-- CreateIndex
CREATE INDEX "Recording_callId_idx" ON "Recording"("callId");

-- CreateIndex
CREATE INDEX "Chat_agentId_idx" ON "Chat"("agentId");

-- CreateIndex
CREATE INDEX "Chat_teamCode_idx" ON "Chat"("teamCode");

-- CreateIndex
CREATE INDEX "Chat_startTime_idx" ON "Chat"("startTime");

-- CreateIndex
CREATE INDEX "Chat_contactId_idx" ON "Chat"("contactId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_idx" ON "ChatMessage"("chatId");

-- CreateIndex
CREATE INDEX "ChatMessage_timestamp_idx" ON "ChatMessage"("timestamp");

-- CreateIndex
CREATE INDEX "ScorecardTemplate_isActive_idx" ON "ScorecardTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ScorecardTemplate_createdAt_idx" ON "ScorecardTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_recordingId_key" ON "Evaluation"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_chatId_key" ON "Evaluation"("chatId");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_idx" ON "Evaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "Evaluation_agentId_idx" ON "Evaluation"("agentId");

-- CreateIndex
CREATE INDEX "Evaluation_teamCode_idx" ON "Evaluation"("teamCode");

-- CreateIndex
CREATE INDEX "Evaluation_status_idx" ON "Evaluation"("status");

-- CreateIndex
CREATE INDEX "Evaluation_createdAt_idx" ON "Evaluation"("createdAt");

-- CreateIndex
CREATE INDEX "EvaluationBookmark_evaluationId_idx" ON "EvaluationBookmark"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationBookmark_recordingId_idx" ON "EvaluationBookmark"("recordingId");

-- CreateIndex
CREATE INDEX "Dispute_evaluationId_idx" ON "Dispute"("evaluationId");

-- CreateIndex
CREATE INDEX "Dispute_userId_idx" ON "Dispute"("userId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingPlan_evaluationId_key" ON "CoachingPlan"("evaluationId");

-- CreateIndex
CREATE INDEX "CoachingPlan_agentId_idx" ON "CoachingPlan"("agentId");

-- CreateIndex
CREATE INDEX "CoachingPlan_supervisorId_idx" ON "CoachingPlan"("supervisorId");

-- CreateIndex
CREATE INDEX "CoachingPlan_status_idx" ON "CoachingPlan"("status");

-- CreateIndex
CREATE INDEX "CoachingPlan_createdAt_idx" ON "CoachingPlan"("createdAt");

-- CreateIndex
CREATE INDEX "SamplingRule_isActive_idx" ON "SamplingRule"("isActive");

-- CreateIndex
CREATE INDEX "SamplingRule_teamCode_idx" ON "SamplingRule"("teamCode");

-- CreateIndex
CREATE INDEX "SamplingRecord_samplingRuleId_idx" ON "SamplingRecord"("samplingRuleId");

-- CreateIndex
CREATE INDEX "SamplingRecord_recordingId_idx" ON "SamplingRecord"("recordingId");

-- CreateIndex
CREATE INDEX "SamplingRecord_agentId_idx" ON "SamplingRecord"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAgentStats_agentId_date_key" ON "DailyAgentStats"("agentId", "date");

-- CreateIndex
CREATE INDEX "DailyAgentStats_agentId_idx" ON "DailyAgentStats"("agentId");

-- CreateIndex
CREATE INDEX "DailyAgentStats_date_idx" ON "DailyAgentStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTeamStats_teamCode_date_key" ON "DailyTeamStats"("teamCode", "date");

-- CreateIndex
CREATE INDEX "DailyTeamStats_teamCode_idx" ON "DailyTeamStats"("teamCode");

-- CreateIndex
CREATE INDEX "DailyTeamStats_date_idx" ON "DailyTeamStats"("date");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_syncType_key" ON "SyncState"("syncType");

-- CreateIndex
CREATE INDEX "SyncState_syncType_idx" ON "SyncState"("syncType");

-- CreateIndex
CREATE INDEX "SyncState_status_idx" ON "SyncState"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_UserTeam_AB_unique" ON "_UserTeam"("A", "B");

-- CreateIndex
CREATE INDEX "_UserTeam_B_index" ON "_UserTeam"("B");

-- AddForeignKey
ALTER TABLE "AgentTeam" ADD CONSTRAINT "AgentTeam_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTeam" ADD CONSTRAINT "AgentTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "Team"("teamCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_scorecardTemplateId_fkey" FOREIGN KEY ("scorecardTemplateId") REFERENCES "ScorecardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "Team"("teamCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationBookmark" ADD CONSTRAINT "EvaluationBookmark_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationBookmark" ADD CONSTRAINT "EvaluationBookmark_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "Team"("teamCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplingRule" ADD CONSTRAINT "SamplingRule_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "Team"("teamCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplingRecord" ADD CONSTRAINT "SamplingRecord_samplingRuleId_fkey" FOREIGN KEY ("samplingRuleId") REFERENCES "SamplingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAgentStats" ADD CONSTRAINT "DailyAgentStats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTeamStats" ADD CONSTRAINT "DailyTeamStats_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "Team"("teamCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTeam" ADD CONSTRAINT "_UserTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTeam" ADD CONSTRAINT "_UserTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
