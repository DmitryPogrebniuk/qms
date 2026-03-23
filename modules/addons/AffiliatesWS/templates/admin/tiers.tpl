<h3>Tiers</h3>
<table class="table table-striped table-bordered">
    <thead><tr><th>Tier</th><th>Min Services</th><th>Max Services</th><th>L1%</th><th>L2%</th><th>L3%</th><th>Count Affiliates</th><th>Total Services</th></tr></thead>
    <tbody>
    <?php
        $limits = [
            'starter' => ['min' => 0, 'max' => 4],
            'bronze' => ['min' => 5, 'max' => 14],
            'silver' => ['min' => 15, 'max' => 49],
            'gold' => ['min' => 50, 'max' => 99],
            'platinum' => ['min' => 100, 'max' => 'INF'],
        ];
        $rates = [
            'starter' => ['l1' => 10, 'l2' => 0, 'l3' => 0],
            'bronze' => ['l1' => 12, 'l2' => 3, 'l3' => 0],
            'silver' => ['l1' => 15, 'l2' => 4, 'l3' => 1],
            'gold' => ['l1' => 17, 'l2' => 5, 'l3' => 2],
            'platinum' => ['l1' => 20, 'l2' => 6, 'l3' => 2],
        ];
        $rowsByTier = [];
        foreach ($tiersRows as $row) { $rowsByTier[(string) $row->tier] = $row; }
    ?>
    <?php foreach (['starter', 'bronze', 'silver', 'gold', 'platinum'] as $tier): $row = $rowsByTier[$tier] ?? null; ?>
        <tr>
            <td><?php echo htmlspecialchars($tier); ?></td>
            <td><?php echo htmlspecialchars((string) $limits[$tier]['min']); ?></td>
            <td><?php echo htmlspecialchars((string) $limits[$tier]['max']); ?></td>
            <td><?php echo number_format((float) $rates[$tier]['l1'], 2); ?></td>
            <td><?php echo number_format((float) $rates[$tier]['l2'], 2); ?></td>
            <td><?php echo number_format((float) $rates[$tier]['l3'], 2); ?></td>
            <td><?php echo (int) ($row->affiliates_count ?? 0); ?></td>
            <td><?php echo (int) ($row->total_services ?? 0); ?></td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>
