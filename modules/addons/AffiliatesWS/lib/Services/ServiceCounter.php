<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Core\ModuleConfig;

final class ServiceCounter
{
    private AffiliateRelationResolver $relationResolver;

    public function __construct(?AffiliateRelationResolver $relationResolver = null)
    {
        $this->relationResolver = $relationResolver ?? new AffiliateRelationResolver();
    }

    public function countActiveServices(int $affiliateId): int
    {
        $minAgeDays = ModuleConfig::getInt('min_service_age_days', 30);
        $date = new \DateTimeImmutable('-' . $minAgeDays . ' days');
        $clientIds = $this->relationResolver->getReferredClientIds($affiliateId);
        if ($clientIds === []) {
            return 0;
        }

        return (int) Capsule::table('tblhosting')
            ->whereIn('tblhosting.userid', $clientIds)
            ->where('tblhosting.domainstatus', 'Active')
            ->whereDate('tblhosting.regdate', '<=', $date->format('Y-m-d'))
            ->count();
    }

    public function calculateWeightedScore(int $affiliateId): float
    {
        $clientIds = $this->relationResolver->getReferredClientIds($affiliateId);
        if ($clientIds === []) {
            return 0.0;
        }

        $sum = (float) Capsule::table('tblhosting')
            ->leftJoin('tblpricing', function ($join): void {
                $join->on('tblpricing.relid', '=', 'tblhosting.packageid')
                    ->where('tblpricing.type', '=', 'product')
                    ->where('tblpricing.currency', '=', Capsule::table('tblcurrencies')->min('id'));
            })
            ->whereIn('tblhosting.userid', $clientIds)
            ->where('tblhosting.domainstatus', 'Active')
            ->sum('tblpricing.monthly');

        $minPrice = (float) Capsule::table('tblpricing')
            ->where('type', 'product')
            ->where('monthly', '>', 0)
            ->min('monthly');

        if ($minPrice <= 0.0) {
            return 0.0;
        }

        return \round($sum / $minPrice, 2);
    }
}
