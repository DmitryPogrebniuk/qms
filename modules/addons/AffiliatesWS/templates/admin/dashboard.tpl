<div class="row">
    <div class="col-md-3"><div class="panel panel-default"><div class="panel-heading">Total Affiliates</div><div class="panel-body"><h3><?php echo (int) $stats['total_affiliates']; ?></h3></div></div></div>
    <div class="col-md-3"><div class="panel panel-warning"><div class="panel-heading">Pending Tasks</div><div class="panel-body"><h3><?php echo (int) $stats['pending_tasks']; ?></h3></div></div></div>
    <div class="col-md-3"><div class="panel panel-danger"><div class="panel-heading">Error Tasks</div><div class="panel-body"><h3><?php echo (int) $stats['error_tasks']; ?></h3></div></div></div>
    <div class="col-md-3"><div class="panel panel-info"><div class="panel-heading">Total Tasks</div><div class="panel-body"><h3><?php echo (int) $stats['total_tasks']; ?></h3></div></div></div>
</div>

<div class="row">
    <div class="col-md-6">
        <h4>Tier Distribution</h4>
        <table class="table table-striped">
            <thead><tr><th>Tier</th><th>Count</th></tr></thead>
            <tbody>
            <?php foreach (['starter', 'bronze', 'silver', 'gold', 'platinum'] as $tier): ?>
                <tr><td><?php echo htmlspecialchars($tier); ?></td><td><?php echo (int) ($tiersDistribution[$tier] ?? 0); ?></td></tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <div class="col-md-6">
        <h4>Recent Tasks</h4>
        <table class="table table-striped">
            <thead><tr><th>ID</th><th>Invoice</th><th>Status</th><th>Attempts</th></tr></thead>
            <tbody>
            <?php foreach ($recentTasks as $task): ?>
                <tr>
                    <td><?php echo (int) $task->id; ?></td>
                    <td><?php echo (int) $task->invoice_id; ?></td>
                    <td><?php echo htmlspecialchars((string) $task->status); ?></td>
                    <td><?php echo (int) $task->attempts; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
