<?php

declare(strict_types=1);

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTier;
use WHMCS\Module\Addon\AffiliatesWS\Services\AffiliateRelationResolver;
use WHMCS\Module\Addon\AffiliatesWS\Services\TreeBuilder;

add_hook('AffiliateActivation', 1, static function (array $vars): void {
    try {
        $affiliateId = (int) ($vars['affiliateid'] ?? 0);
        if ($affiliateId <= 0) {
            return;
        }

        AffiliateTier::query()->firstOrCreate(
            ['affiliate_id' => $affiliateId],
            ['tier' => 'starter', 'active_services' => 0, 'weighted_score' => 0]
        );

        $clientId = (int) Capsule::table('tblaffiliates')->where('id', $affiliateId)->value('clientid');
        $parentAffiliateId = (new AffiliateRelationResolver())->getClientReferrerAffiliateId($clientId);
        if ($parentAffiliateId > 0) {
            (new TreeBuilder())->registerSubAffiliate($parentAffiliateId, $affiliateId);
        }
    } catch (\Throwable $e) {
        logActivity('AffiliatesWS AffiliateActivation hook error: ' . $e->getMessage());
    }
});
