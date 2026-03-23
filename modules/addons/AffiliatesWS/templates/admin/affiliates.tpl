<h3>Affiliates</h3>
<table class="table table-striped table-bordered">
    <thead><tr><th>ID</th><th>Affiliate ID</th><th>Tier</th><th>Active Services</th><th>Weighted Score</th><th>Last Recalc</th></tr></thead>
    <tbody>
    <?php foreach ($affiliates as $row): ?>
        <tr>
            <td><?php echo (int) $row->id; ?></td>
            <td><?php echo (int) $row->affiliate_id; ?></td>
            <td><?php echo htmlspecialchars((string) $row->tier); ?></td>
            <td><?php echo (int) $row->active_services; ?></td>
            <td><?php echo number_format((float) $row->weighted_score, 2); ?></td>
            <td><?php echo htmlspecialchars((string) $row->last_recalc_at); ?></td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>
