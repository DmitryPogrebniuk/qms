<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTree;

final class TreeBuilder
{
    public function registerReferral(int $affiliateId, int $clientId): AffiliateTree
    {
        $chain = $this->getChain($affiliateId);

        /** @var AffiliateTree $model */
        $model = AffiliateTree::query()->updateOrCreate(
            ['affiliate_id' => $affiliateId, 'client_id' => $clientId, 'type' => 'referral'],
            [
                'parent_affiliate_id' => $chain['l2_affiliate'],
                'grandparent_affiliate_id' => $chain['l3_affiliate'],
            ]
        );

        return $model;
    }

    public function registerSubAffiliate(int $parentAffiliateId, int $childAffiliateId): AffiliateTree
    {
        $parentRecord = AffiliateTree::query()
            ->where('affiliate_id', $parentAffiliateId)
            ->where('type', 'sub_affiliate')
            ->first();

        /** @var AffiliateTree $model */
        $model = AffiliateTree::query()->updateOrCreate(
            ['affiliate_id' => $childAffiliateId, 'type' => 'sub_affiliate', 'client_id' => null],
            [
                'parent_affiliate_id' => $parentAffiliateId,
                'grandparent_affiliate_id' => $parentRecord?->parent_affiliate_id,
            ]
        );

        return $model;
    }

    /** @return array{l1_affiliate: int, l2_affiliate: ?int, l3_affiliate: ?int} */
    public function getChain(int $affiliateId): array
    {
        $row = AffiliateTree::query()
            ->where('affiliate_id', $affiliateId)
            ->where('type', 'sub_affiliate')
            ->first();

        return [
            'l1_affiliate' => $affiliateId,
            'l2_affiliate' => $row?->parent_affiliate_id ? (int) $row->parent_affiliate_id : null,
            'l3_affiliate' => $row?->grandparent_affiliate_id ? (int) $row->grandparent_affiliate_id : null,
        ];
    }
}
