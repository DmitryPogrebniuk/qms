-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('FRONTEND', 'BACKEND', 'DATABASE', 'SEARCH', 'INTEGRATION', 'WORKER', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('OK', 'DEGRADED', 'DOWN', 'UNKNOWN', 'RESTARTING');

-- CreateEnum
CREATE TYPE "RestartMethod" AS ENUM ('DOCKER', 'KUBERNETES', 'SYSTEMD', 'INTERNAL', 'NONE');

-- CreateEnum
CREATE TYPE "HealthCheckType" AS ENUM ('HTTP_PING', 'TCP_CONNECT', 'DB_QUERY', 'METRIC_CHECK', 'QUEUE_LAG', 'DISK_SPACE', 'MEMORY_USAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HealthCheckStatus" AS ENUM ('OK', 'WARNING', 'CRITICAL', 'UNKNOWN', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MaintenanceActionType" AS ENUM ('RESTART', 'CLEAR_CACHE', 'CLEAR_LOGS', 'REINDEX', 'RUN_HEALTH_CHECK', 'TRIGGER_SYNC', 'ROTATE_LOGS', 'DIAGNOSTICS_BUNDLE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('COMPONENT_DOWN', 'COMPONENT_DEGRADED', 'HIGH_ERROR_RATE', 'HIGH_LATENCY', 'QUEUE_BACKLOG', 'DISK_SPACE_LOW', 'MEMORY_HIGH', 'SYNC_FAILED', 'HEALTH_CHECK_FAILED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateTable
CREATE TABLE "SystemComponent" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "componentType" "ComponentType" NOT NULL,
    "status" "ComponentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "statusReason" TEXT,
    "lastHeartbeat" TIMESTAMPTZ,
    "lastHealthCheck" TIMESTAMPTZ,
    "version" VARCHAR(50),
    "buildId" VARCHAR(100),
    "startedAt" TIMESTAMPTZ,
    "metrics" JSONB,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isRestartable" BOOLEAN NOT NULL DEFAULT true,
    "restartMethod" "RestartMethod" NOT NULL DEFAULT 'DOCKER',
    "restartConfig" JSONB,
    "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "checkType" "HealthCheckType" NOT NULL,
    "config" JSONB,
    "warningThreshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "lastStatus" "HealthCheckStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastValue" DOUBLE PRECISION,
    "lastMessage" TEXT,
    "lastCheckedAt" TIMESTAMPTZ,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 10,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isCritical" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAction" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "actionType" "MaintenanceActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "actorId" TEXT NOT NULL,
    "actorName" VARCHAR(100),
    "reason" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,
    "resultMessage" TEXT,
    "resultDetails" JSONB,
    "jobId" VARCHAR(100),
    "progress" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAlert" (
    "id" TEXT NOT NULL,
    "componentId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "notificationsSent" JSONB,
    "triggeredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertNotificationSetting" (
    "id" TEXT NOT NULL,
    "alertType" "AlertType",
    "severity" "AlertSeverity",
    "componentCode" VARCHAR(50),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyUI" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemComponent_code_key" ON "SystemComponent"("code");

-- CreateIndex
CREATE INDEX "SystemComponent_code_idx" ON "SystemComponent"("code");

-- CreateIndex
CREATE INDEX "SystemComponent_status_idx" ON "SystemComponent"("status");

-- CreateIndex
CREATE INDEX "SystemComponent_componentType_idx" ON "SystemComponent"("componentType");

-- CreateIndex
CREATE INDEX "HealthCheck_componentId_idx" ON "HealthCheck"("componentId");

-- CreateIndex
CREATE INDEX "HealthCheck_lastStatus_idx" ON "HealthCheck"("lastStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAction_jobId_key" ON "MaintenanceAction"("jobId");

-- CreateIndex
CREATE INDEX "MaintenanceAction_componentId_idx" ON "MaintenanceAction"("componentId");

-- CreateIndex
CREATE INDEX "MaintenanceAction_actorId_idx" ON "MaintenanceAction"("actorId");

-- CreateIndex
CREATE INDEX "MaintenanceAction_requestedAt_idx" ON "MaintenanceAction"("requestedAt");

-- CreateIndex
CREATE INDEX "MaintenanceAction_status_idx" ON "MaintenanceAction"("status");

-- CreateIndex
CREATE INDEX "MaintenanceAlert_componentId_idx" ON "MaintenanceAlert"("componentId");

-- CreateIndex
CREATE INDEX "MaintenanceAlert_isActive_idx" ON "MaintenanceAlert"("isActive");

-- CreateIndex
CREATE INDEX "MaintenanceAlert_severity_idx" ON "MaintenanceAlert"("severity");

-- CreateIndex
CREATE INDEX "MaintenanceAlert_triggeredAt_idx" ON "MaintenanceAlert"("triggeredAt");

-- CreateIndex
CREATE INDEX "AlertNotificationSetting_alertType_idx" ON "AlertNotificationSetting"("alertType");

-- CreateIndex
CREATE INDEX "AlertNotificationSetting_severity_idx" ON "AlertNotificationSetting"("severity");

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SystemComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAction" ADD CONSTRAINT "MaintenanceAction_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SystemComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAlert" ADD CONSTRAINT "MaintenanceAlert_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SystemComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
