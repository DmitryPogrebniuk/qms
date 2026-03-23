<?php

declare(strict_types=1);

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Services\AffiliateRelationResolver;
use WHMCS\Module\Addon\AffiliatesWS\Services\TreeBuilder;

add_hook('ClientAdd', 1, static function (array $vars): void {
    try {
        $clientId = (int) ($vars['userid'] ?? 0);
        if ($clientId <= 0) {
            return;
        }

        $affiliateId = (new AffiliateRelationResolver())->getClientReferrerAffiliateId($clientId);
        if ($affiliateId > 0) {
            (new TreeBuilder())->registerReferral($affiliateId, $clientId);
        }
    } catch (\Throwable $e) {
        logActivity('AffiliatesWS ClientAdd hook error: ' . $e->getMessage());
    }
});
