<h3>Tasks Queue</h3>
<table class="table table-bordered table-striped" id="aws-tasks-table">
    <thead>
    <tr>
        <th>ID</th>
        <th>Invoice</th>
        <th>Client</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Attempts</th>
        <th>Created</th>
        <th>Actions</th>
    </tr>
    </thead>
    <tbody>
    <?php foreach ($tasks as $task): ?>
        <tr data-task-id="<?php echo (int) $task->id; ?>">
            <td><?php echo (int) $task->id; ?></td>
            <td><?php echo (int) $task->invoice_id; ?></td>
            <td><?php echo (int) $task->client_id; ?></td>
            <td><?php echo number_format((float) $task->amount, 2); ?></td>
            <td><span class="label label-default js-status"><?php echo htmlspecialchars((string) $task->status); ?></span></td>
            <td><?php echo (int) $task->attempts; ?></td>
            <td><?php echo htmlspecialchars((string) $task->created_at); ?></td>
            <td>
                <button class="btn btn-xs btn-primary js-run-task" <?php echo \in_array($task->status, ['running', 'done'], true) ? 'disabled' : ''; ?>>Run</button>
                <button class="btn btn-xs btn-default js-logs-task">Logs</button>
            </td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>

<div class="modal fade" id="aws-logs-modal" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header"><button type="button" class="close" data-dismiss="modal"><span>&times;</span></button><h4 class="modal-title">Task Logs</h4></div>
            <div class="modal-body"><div id="aws-logs-body">Loading...</div></div>
        </div>
    </div>
</div>

<script>
jQuery(function($) {
    function postAjax(payload) {
        return $.post(window.location.href, payload, null, 'json');
    }

    $('.js-run-task').on('click', function() {
        var $row = $(this).closest('tr');
        var taskId = $row.data('task-id');
        postAjax({ajax_action: 'run_task', task_id: taskId}).done(function(res) {
            if (res && res.ok) {
                $row.find('.js-status').text(res.status);
            } else {
                alert((res && res.message) || 'Failed to run task');
            }
        });
    });

    $('.js-logs-task').on('click', function() {
        var $row = $(this).closest('tr');
        var taskId = $row.data('task-id');
        postAjax({ajax_action: 'get_task_logs', task_id: taskId}).done(function(res) {
            if (!res || !res.ok) {
                $('#aws-logs-body').html('<div class="alert alert-danger">Unable to fetch logs</div>');
                $('#aws-logs-modal').modal('show');
                return;
            }
            var html = '<table class="table table-striped"><thead><tr><th>#</th><th>Attempt</th><th>Result</th><th>Message</th><th>Details</th><th>Date</th></tr></thead><tbody>';
            (res.logs || []).forEach(function(log) {
                var rowClass = log.result === 'error' ? ' class="danger"' : '';
                html += '<tr' + rowClass + '><td>' + log.id + '</td><td>' + log.attempt + '</td><td>' + log.result + '</td><td>' +
                    (log.message || '') + '</td><td><pre>' + (log.details || '') + '</pre></td><td>' + (log.created_at || '') + '</td></tr>';
            });
            html += '</tbody></table>';
            $('#aws-logs-body').html(html);
            $('#aws-logs-modal').modal('show');
        });
    });
});
</script>
