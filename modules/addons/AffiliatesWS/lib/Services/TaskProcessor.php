<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Module\Addon\AffiliatesWS\Core\ModuleConfig;
use WHMCS\Module\Addon\AffiliatesWS\Models\CommissionTask;
use WHMCS\Module\Addon\AffiliatesWS\Models\CommissionTaskLog;

final class TaskProcessor
{
    private CommissionEngine $engine;

    public function __construct(?CommissionEngine $engine = null)
    {
        $this->engine = $engine ?? new CommissionEngine();
    }

    /** @return array{processed: int, success: int, errors: int} */
    public function processBatch(): array
    {
        $batchSize = ModuleConfig::getInt('cron_batch_size', 50);
        $tasks = CommissionTask::lockBatch($batchSize);

        $result = ['processed' => 0, 'success' => 0, 'errors' => 0];
        foreach ($tasks as $task) {
            $result['processed']++;
            if ($this->processSingleTask($task)) {
                $result['success']++;
            } else {
                $result['errors']++;
            }
        }

        return $result;
    }

    public function processSingleTask(CommissionTask $task): bool
    {
        if ($task->status === CommissionTask::STATUS_DONE) {
            return false;
        }

        if ($task->status === CommissionTask::STATUS_RUNNING && $task->locked_at) {
            $lockedTs = \strtotime((string) $task->locked_at);
            if ($lockedTs !== false && $lockedTs > \strtotime('-5 minutes')) {
                return false;
            }
        }

        $task->status = CommissionTask::STATUS_RUNNING;
        $task->locked_at = \date('Y-m-d H:i:s');
        $task->attempts = (int) $task->attempts + 1;
        $task->save();

        try {
            $payload = \json_decode((string) $task->payload, true, 512, JSON_THROW_ON_ERROR);
            $affiliateId = (int) ($payload['affiliate_id'] ?? 0);
            $amount = (float) ($payload['amount'] ?? $task->amount);
            $invoiceId = (int) ($payload['invoice_id'] ?? $task->invoice_id);

            $commissions = $this->engine->processPayment($affiliateId, $amount, $invoiceId);

            $task->status = CommissionTask::STATUS_DONE;
            $task->completed_at = \date('Y-m-d H:i:s');
            $task->commissions_json = \json_encode($commissions, JSON_THROW_ON_ERROR);
            $task->last_error = null;
            $task->save();

            CommissionTaskLog::query()->create([
                'task_id' => $task->id,
                'attempt' => $task->attempts,
                'result' => 'success',
                'message' => 'Task processed successfully',
                'details' => $task->commissions_json,
            ]);

            return true;
        } catch (\Throwable $e) {
            $task->status = CommissionTask::STATUS_ERROR;
            $task->last_error = $e->getMessage();
            $task->locked_at = null;
            $task->save();

            CommissionTaskLog::query()->create([
                'task_id' => $task->id,
                'attempt' => $task->attempts,
                'result' => 'error',
                'message' => $e->getMessage(),
                'details' => \json_encode(['trace' => $e->getTraceAsString()]),
            ]);

            return false;
        }
    }
}
