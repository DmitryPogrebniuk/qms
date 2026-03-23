<?php

declare(strict_types=1);

if (!\defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Bootstrap;
use WHMCS\Module\Addon\AffiliatesWS\Database\SchemaManager;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliatePayout;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTier;
use WHMCS\Module\Addon\AffiliatesWS\Models\CommissionTask;
use WHMCS\Module\Addon\AffiliatesWS\Models\CommissionTaskLog;
use WHMCS\Module\Addon\AffiliatesWS\Services\TaskProcessor;

Bootstrap::boot();

function AffiliatesWS_config(): array
{
    return [
        'name' => 'AffiliatesWS',
        'description' => 'Multi-level affiliate module with tiering and queue processing',
        'version' => '1.0.0',
        'author' => 'inet.ws',
        'language' => 'english',
        'fields' => [
            'cron_batch_size' => ['FriendlyName' => 'Cron Batch Size', 'Type' => 'text', 'Default' => '50'],
            'cookie_days' => ['FriendlyName' => 'Cookie Days', 'Type' => 'text', 'Default' => '60'],
            'recurring_months' => ['FriendlyName' => 'Recurring Months', 'Type' => 'text', 'Default' => '60'],
            'min_payout' => ['FriendlyName' => 'Minimum Payout', 'Type' => 'text', 'Default' => '25'],
            'min_service_age_days' => ['FriendlyName' => 'Min Service Age (days)', 'Type' => 'text', 'Default' => '30'],
            'tier_starter_max' => ['FriendlyName' => 'Starter Max Services', 'Type' => 'text', 'Default' => '4'],
            'tier_bronze_min' => ['FriendlyName' => 'Bronze Min Services', 'Type' => 'text', 'Default' => '5'],
            'tier_bronze_max' => ['FriendlyName' => 'Bronze Max Services', 'Type' => 'text', 'Default' => '14'],
            'tier_silver_min' => ['FriendlyName' => 'Silver Min Services', 'Type' => 'text', 'Default' => '15'],
            'tier_silver_max' => ['FriendlyName' => 'Silver Max Services', 'Type' => 'text', 'Default' => '49'],
            'tier_gold_min' => ['FriendlyName' => 'Gold Min Services', 'Type' => 'text', 'Default' => '50'],
            'tier_gold_max' => ['FriendlyName' => 'Gold Max Services', 'Type' => 'text', 'Default' => '99'],
            'tier_platinum_min' => ['FriendlyName' => 'Platinum Min Services', 'Type' => 'text', 'Default' => '100'],
            'rate_starter_l1' => ['FriendlyName' => 'Starter L1 %', 'Type' => 'text', 'Default' => '10'],
            'rate_bronze_l1' => ['FriendlyName' => 'Bronze L1 %', 'Type' => 'text', 'Default' => '12'],
            'rate_bronze_l2' => ['FriendlyName' => 'Bronze L2 %', 'Type' => 'text', 'Default' => '3'],
            'rate_silver_l1' => ['FriendlyName' => 'Silver L1 %', 'Type' => 'text', 'Default' => '15'],
            'rate_silver_l2' => ['FriendlyName' => 'Silver L2 %', 'Type' => 'text', 'Default' => '4'],
            'rate_silver_l3' => ['FriendlyName' => 'Silver L3 %', 'Type' => 'text', 'Default' => '1'],
            'rate_gold_l1' => ['FriendlyName' => 'Gold L1 %', 'Type' => 'text', 'Default' => '17'],
            'rate_gold_l2' => ['FriendlyName' => 'Gold L2 %', 'Type' => 'text', 'Default' => '5'],
            'rate_gold_l3' => ['FriendlyName' => 'Gold L3 %', 'Type' => 'text', 'Default' => '2'],
            'rate_platinum_l1' => ['FriendlyName' => 'Platinum L1 %', 'Type' => 'text', 'Default' => '20'],
            'rate_platinum_l2' => ['FriendlyName' => 'Platinum L2 %', 'Type' => 'text', 'Default' => '6'],
            'rate_platinum_l3' => ['FriendlyName' => 'Platinum L3 %', 'Type' => 'text', 'Default' => '2'],
        ],
    ];
}

function AffiliatesWS_activate(): array
{
    try {
        (new SchemaManager())->runMigrations();
        return ['status' => 'success', 'description' => 'AffiliatesWS activated'];
    } catch (\Throwable $e) {
        return ['status' => 'error', 'description' => $e->getMessage()];
    }
}

function AffiliatesWS_deactivate(): array
{
    return ['status' => 'success', 'description' => 'AffiliatesWS deactivated'];
}

function AffiliatesWS_upgrade(array $vars): void
{
    (new SchemaManager())->runMigrations();
}

function AffiliatesWS_sidebar(array $vars): string
{
    $module = $vars['modulelink'] ?? 'addonmodules.php?module=AffiliatesWS';
    $moduleName = (string) ($vars['module'] ?? 'AffiliatesWS');
    $items = [
        'dashboard' => 'Dashboard',
        'tasks' => 'Tasks Queue',
        'affiliates' => 'Affiliates',
        'tiers' => 'Tiers',
        'payouts' => 'Payouts',
    ];

    $iconPath = '/modules/addons/' . $moduleName . '/image/logo.png';
    $hasIcon = \is_file(ROOTDIR . '/modules/addons/' . $moduleName . '/image/logo.png');
    $header = $hasIcon
        ? '<img src="' . \htmlspecialchars($iconPath) . '" class="absmiddle" width="20" height="20" alt="AffiliatesWS">&nbsp;AffiliatesWS'
        : 'AffiliatesWS';

    $html = '<div class="sidebar-header"><span class="header">' . $header . '</span></div>';
    $html .= '<ul class="menu">';
    foreach ($items as $action => $label) {
        $url = $module . '&action=' . $action;
        $html .= '<li><a href="' . \htmlspecialchars($url) . '">' . \htmlspecialchars($label) . '</a></li>';
    }
    $html .= '</ul>';

    return $html;
}

function AffiliatesWS_output(array $vars): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['ajax_action'])) {
        AffiliatesWS_handleAjax();
        return;
    }

    $action = isset($_GET['action']) ? (string) $_GET['action'] : 'dashboard';
    $template = __DIR__ . '/templates/admin/' . $action . '.tpl';
    if (!\is_file($template)) {
        $template = __DIR__ . '/templates/admin/dashboard.tpl';
    }

    $context = AffiliatesWS_getAdminContext($vars);
    extract($context, EXTR_SKIP);
    include $template;
}

function AffiliatesWS_handleAjax(): void
{
    \header('Content-Type: application/json');

    try {
        $action = (string) ($_POST['ajax_action'] ?? '');
        $processor = new TaskProcessor();

        if ($action === 'run_task') {
            $taskId = (int) ($_POST['task_id'] ?? 0);
            $task = CommissionTask::query()->findOrFail($taskId);
            if ($task->status === CommissionTask::STATUS_RUNNING) {
                echo \json_encode(['ok' => false, 'message' => 'Task is already running']);
                return;
            }

            $ok = $processor->processSingleTask($task);
            echo \json_encode(['ok' => $ok, 'status' => $task->fresh()->status]);
            return;
        }

        if ($action === 'get_task_logs') {
            $taskId = (int) ($_POST['task_id'] ?? 0);
            $logs = CommissionTaskLog::query()
                ->where('task_id', $taskId)
                ->orderByDesc('id')
                ->get()
                ->map(static fn (CommissionTaskLog $log): array => [
                    'id' => $log->id,
                    'attempt' => $log->attempt,
                    'result' => $log->result,
                    'message' => $log->message,
                    'details' => $log->details,
                    'created_at' => (string) $log->created_at,
                ])
                ->values()
                ->all();

            echo \json_encode(['ok' => true, 'logs' => $logs]);
            return;
        }

        echo \json_encode(['ok' => false, 'message' => 'Unknown action']);
    } catch (\Throwable $e) {
        echo \json_encode(['ok' => false, 'message' => $e->getMessage()]);
    }
}

/** @return array<string, mixed> */
function AffiliatesWS_getAdminContext(array $vars): array
{
    $page = \max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 25;

    $statusCounts = CommissionTask::query()
        ->select(['status', Capsule::raw('COUNT(*) AS c')])
        ->groupBy('status')
        ->pluck('c', 'status');

    $tierDistribution = AffiliateTier::query()
        ->select(['tier', Capsule::raw('COUNT(*) AS c')])
        ->groupBy('tier')
        ->pluck('c', 'tier');

    return [
        'modulelink' => $vars['modulelink'] ?? 'addonmodules.php?module=AffiliatesWS',
        'stats' => [
            'total_affiliates' => (int) Capsule::table('tblaffiliates')->count(),
            'pending_tasks' => (int) ($statusCounts['waiting'] ?? 0),
            'error_tasks' => (int) ($statusCounts['error'] ?? 0),
            'total_tasks' => (int) CommissionTask::query()->count(),
        ],
        'recentTasks' => CommissionTask::query()->orderByDesc('id')->limit(10)->get(),
        'tasks' => CommissionTask::query()->orderByDesc('id')->forPage($page, $perPage)->get(),
        'affiliates' => AffiliateTier::query()->orderByDesc('id')->forPage($page, $perPage)->get(),
        'tiersDistribution' => $tierDistribution,
        'tiersRows' => AffiliateTier::query()
            ->select(['tier', Capsule::raw('COUNT(*) AS affiliates_count'), Capsule::raw('SUM(active_services) AS total_services')])
            ->groupBy('tier')
            ->get(),
        'payouts' => AffiliatePayout::query()->orderByDesc('id')->forPage($page, $perPage)->get(),
        'currentAction' => (string) ($_GET['action'] ?? 'dashboard'),
    ];
}
