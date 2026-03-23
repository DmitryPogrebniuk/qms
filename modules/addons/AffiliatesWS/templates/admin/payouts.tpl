<h3>Payouts</h3>
<table class="table table-striped table-bordered">
    <thead><tr><th>ID</th><th>Affiliate</th><th>Amount</th><th>Status</th><th>Method</th><th>Date</th></tr></thead>
    <tbody>
    <?php foreach ($payouts as $payout): ?>
        <tr>
            <td><?php echo (int) $payout->id; ?></td>
            <td><?php echo (int) $payout->affiliate_id; ?></td>
            <td><?php echo number_format((float) $payout->amount, 2); ?></td>
            <td><?php echo htmlspecialchars((string) $payout->status); ?></td>
            <td><?php echo htmlspecialchars((string) $payout->payment_method); ?></td>
            <td><?php echo htmlspecialchars((string) $payout->created_at); ?></td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>
