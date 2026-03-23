<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Core;

use WHMCS\Module\Addon\AffiliatesWS\Services\TaskProcessor;
use WHMCS\Module\Addon\AffiliatesWS\Services\TierManager;

final class CronEngine
{
    private static ?self $instance = null;

    private TaskProcessor $taskProcessor;
    private TierManager $tierManager;

    private function __construct()
    {
        $this->taskProcessor = new TaskProcessor();
        $this->tierManager = new TierManager();
    }

    public static function getInstance(): self
    {
        if (!self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    /** @return array{report: array<string, mixed>, errors: list<string>} */
    public function tasks(): array
    {
        $errors = [];

        try {
            $taskResult = $this->taskProcessor->processBatch();
        } catch (\Throwable $e) {
            $taskResult = ['processed' => 0, 'success' => 0, 'errors' => 1];
            $errors[] = $e->getMessage();
        }

        try {
            $tiersRecalculated = $this->tierManager->recalculateAll();
        } catch (\Throwable $e) {
            $tiersRecalculated = 0;
            $errors[] = $e->getMessage();
        }

        $report = [
            'task_result' => $taskResult,
            'tiers_recalculated' => $tiersRecalculated,
            'completed_at' => \date('c'),
        ];

        \fwrite(STDOUT, \json_encode($report, JSON_PRETTY_PRINT) . PHP_EOL);
        foreach ($errors as $error) {
            \fwrite(STDERR, $error . PHP_EOL);
        }

        if (\function_exists('run_hook')) {
            run_hook('AffiliatesWSCronComplete', ['report' => $report, 'errors' => $errors]);
        }

        return ['report' => $report, 'errors' => $errors];
    }
}
