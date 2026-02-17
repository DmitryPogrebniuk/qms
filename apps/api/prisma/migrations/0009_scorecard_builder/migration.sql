-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('YES_NO', 'SCALE', 'TEXT', 'DROPDOWN', 'CRITICAL');

-- AlterEnum (add APPROVED to EvaluationStatus)
ALTER TYPE "EvaluationStatus" ADD VALUE 'APPROVED';

-- CreateTable Scorecard
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable ScorecardSection
CREATE TABLE "ScorecardSection" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable ScorecardQuestion
CREATE TABLE "ScorecardQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable EvaluationAnswer
CREATE TABLE "EvaluationAnswer" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT,
    "score" DOUBLE PRECISION,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationAnswer_pkey" PRIMARY KEY ("id")
);

-- AlterTable Evaluation: make scorecardTemplateId nullable, add scorecardId, finalScore
ALTER TABLE "Evaluation" ALTER COLUMN "scorecardTemplateId" DROP NOT NULL;
ALTER TABLE "Evaluation" ADD COLUMN "scorecardId" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "finalScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Scorecard_isActive_idx" ON "Scorecard"("isActive");
CREATE INDEX "Scorecard_createdBy_idx" ON "Scorecard"("createdBy");
CREATE INDEX "ScorecardSection_scorecardId_idx" ON "ScorecardSection"("scorecardId");
CREATE INDEX "ScorecardQuestion_sectionId_idx" ON "ScorecardQuestion"("sectionId");
CREATE UNIQUE INDEX "EvaluationAnswer_evaluationId_questionId_key" ON "EvaluationAnswer"("evaluationId", "questionId");
CREATE INDEX "EvaluationAnswer_evaluationId_idx" ON "EvaluationAnswer"("evaluationId");
CREATE INDEX "EvaluationAnswer_questionId_idx" ON "EvaluationAnswer"("questionId");
CREATE INDEX "Evaluation_scorecardId_idx" ON "Evaluation"("scorecardId");

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScorecardSection" ADD CONSTRAINT "ScorecardSection_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardQuestion" ADD CONSTRAINT "ScorecardQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ScorecardSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationAnswer" ADD CONSTRAINT "EvaluationAnswer_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationAnswer" ADD CONSTRAINT "EvaluationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ScorecardQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
