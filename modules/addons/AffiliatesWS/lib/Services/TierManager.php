<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Core\ModuleConfig;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTier;

final class TierManager
{
    /** @var array<string, int> */
    private array $thresholds;

    /** @var array<string, array<string, float>> */
    private array $rates;

    private ServiceCounter $serviceCounter;

    public function __construct(?ServiceCounter $serviceCounter = null)
    {
        $this->serviceCounter = $serviceCounter ?? new ServiceCounter();
        $this->thresholds = [
            'starter_max' => ModuleConfig::getInt('tier_starter_max', 4),
            'bronze_min' => ModuleConfig::getInt('tier_bronze_min', 5),
            'bronze_max' => ModuleConfig::getInt('tier_bronze_max', 14),
            'silver_min' => ModuleConfig::getInt('tier_silver_min', 15),
            'silver_max' => ModuleConfig::getInt('tier_silver_max', 49),
            'gold_min' => ModuleConfig::getInt('tier_gold_min', 50),
            'gold_max' => ModuleConfig::getInt('tier_gold_max', 99),
            'platinum_min' => ModuleConfig::getInt('tier_platinum_min', 100),
        ];

        $this->rates = [
            'starter' => ['l1' => ModuleConfig::getFloat('rate_starter_l1', 10), 'l2' => 0, 'l3' => 0],
            'bronze' => [
                'l1' => ModuleConfig::getFloat('rate_bronze_l1', 12),
                'l2' => ModuleConfig::getFloat('rate_bronze_l2', 3),
                'l3' => 0,
            ],
            'silver' => [
                'l1' => ModuleConfig::getFloat('rate_silver_l1', 15),
                'l2' => ModuleConfig::getFloat('rate_silver_l2', 4),
                'l3' => ModuleConfig::getFloat('rate_silver_l3', 1),
            ],
            'gold' => [
                'l1' => ModuleConfig::getFloat('rate_gold_l1', 17),
                'l2' => ModuleConfig::getFloat('rate_gold_l2', 5),
                'l3' => ModuleConfig::getFloat('rate_gold_l3', 2),
            ],
            'platinum' => [
                'l1' => ModuleConfig::getFloat('rate_platinum_l1', 20),
                'l2' => ModuleConfig::getFloat('rate_platinum_l2', 6),
                'l3' => ModuleConfig::getFloat('rate_platinum_l3', 2),
            ],
        ];
    }

    public function determineTier(int $activeServices): string
    {
        if ($activeServices >= $this->thresholds['platinum_min']) {
            return 'platinum';
        }
        if ($activeServices >= $this->thresholds['gold_min'] && $activeServices <= $this->thresholds['gold_max']) {
            return 'gold';
        }
        if ($activeServices >= $this->thresholds['silver_min'] && $activeServices <= $this->thresholds['silver_max']) {
            return 'silver';
        }
        if ($activeServices >= $this->thresholds['bronze_min'] && $activeServices <= $this->thresholds['bronze_max']) {
            return 'bronze';
        }
        return 'starter';
    }

    /** @return array{l1: float, l2: float, l3: float} */
    public function getRates(string $tier): array
    {
        return $this->rates[$tier] ?? $this->rates['starter'];
    }

    public function recalculate(int $affiliateId): AffiliateTier
    {
        $activeServices = $this->serviceCounter->countActiveServices($affiliateId);
        $tier = $this->determineTier($activeServices);
        $weightedScore = $this->serviceCounter->calculateWeightedScore($affiliateId);

        /** @var AffiliateTier $model */
        $model = AffiliateTier::query()->updateOrCreate(
            ['affiliate_id' => $affiliateId],
            [
                'tier' => $tier,
                'active_services' => $activeServices,
                'weighted_score' => $weightedScore,
                'last_recalc_at' => \date('Y-m-d H:i:s'),
            ]
        );

        return $model;
    }

    public function recalculateAll(): int
    {
        $count = 0;
        $affiliateIds = Capsule::table('tblaffiliates')->pluck('id')->all();
        foreach ($affiliateIds as $affiliateId) {
            $this->recalculate((int) $affiliateId);
            $count++;
        }

        return $count;
    }
}
