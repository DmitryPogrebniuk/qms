<?php

declare(strict_types=1);

use WHMCS\Database\Capsule;

add_hook('AdminAreaClientSummaryPage', 1, static function (array $vars): array {
    try {
        $userId = (int) ($vars['userid'] ?? 0);
        if ($userId <= 0) {
            return [];
        }

        $affiliateId = (int) Capsule::table('tblaffiliates')->where('clientid', $userId)->value('id');
        if ($affiliateId <= 0) {
            return [];
        }

        $tier = Capsule::table('aws_affiliate_tiers')->where('affiliate_id', $affiliateId)->value('tier') ?? 'starter';
        $html = '<div class="alert alert-info"><strong>AffiliatesWS Tier:</strong> ' . \htmlspecialchars((string) $tier) . '</div>';

        return ['affiliateswsTierInfo' => $html];
    } catch (\Throwable $e) {
        logActivity('AffiliatesWS AdminAreaClientSummary hook error: ' . $e->getMessage());
        return [];
    }
});
