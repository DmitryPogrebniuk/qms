<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Core\ModuleConfig;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliatePayout;

final class PayoutProcessor
{
    public function requestPayout(int $affiliateId): ?AffiliatePayout
    {
        $minPayout = ModuleConfig::getFloat('min_payout', 25);
        $balance = (float) Capsule::table('tblaffiliates')->where('id', $affiliateId)->value('balance');

        if ($balance < $minPayout) {
            return null;
        }

        /** @var AffiliatePayout $payout */
        $payout = AffiliatePayout::query()->create([
            'affiliate_id' => $affiliateId,
            'amount' => $balance,
            'status' => 'pending',
        ]);

        return $payout;
    }
}
