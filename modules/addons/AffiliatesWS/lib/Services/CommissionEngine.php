<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Database\Capsule;

final class CommissionEngine
{
    private TierManager $tierManager;
    private TreeBuilder $treeBuilder;

    public function __construct(?TierManager $tierManager = null, ?TreeBuilder $treeBuilder = null)
    {
        $this->tierManager = $tierManager ?? new TierManager();
        $this->treeBuilder = $treeBuilder ?? new TreeBuilder();
    }

    /** @return list<array{level: string, affiliate_id: int, rate: float, amount: float}> */
    public function processPayment(int $affiliateId, float $amount, int $invoiceId): array
    {
        $commissions = [];
        $chain = $this->treeBuilder->getChain($affiliateId);

        $l1Tier = $this->tierManager->recalculate($affiliateId);
        $l1Rates = $this->tierManager->getRates($l1Tier->tier);
        $l1Amount = \round($amount * ($l1Rates['l1'] / 100), 2);
        if ($l1Amount > 0) {
            $this->addCommission($affiliateId, $l1Amount, $invoiceId, 'L1 commission');
            $commissions[] = ['level' => 'L1', 'affiliate_id' => $affiliateId, 'rate' => $l1Rates['l1'], 'amount' => $l1Amount];
        }

        if ($chain['l2_affiliate']) {
            $l2Id = (int) $chain['l2_affiliate'];
            $l2Tier = $this->tierManager->recalculate($l2Id);
            $l2Rates = $this->tierManager->getRates($l2Tier->tier);
            $l2Amount = \round($amount * ($l2Rates['l2'] / 100), 2);
            if ($l2Amount > 0) {
                $this->addCommission($l2Id, $l2Amount, $invoiceId, 'L2 commission');
                $commissions[] = ['level' => 'L2', 'affiliate_id' => $l2Id, 'rate' => $l2Rates['l2'], 'amount' => $l2Amount];
            }
        }

        if ($chain['l3_affiliate']) {
            $l3Id = (int) $chain['l3_affiliate'];
            $l3Tier = $this->tierManager->recalculate($l3Id);
            $l3Rates = $this->tierManager->getRates($l3Tier->tier);
            $l3Amount = \round($amount * ($l3Rates['l3'] / 100), 2);
            if ($l3Amount > 0) {
                $this->addCommission($l3Id, $l3Amount, $invoiceId, 'L3 commission');
                $commissions[] = ['level' => 'L3', 'affiliate_id' => $l3Id, 'rate' => $l3Rates['l3'], 'amount' => $l3Amount];
            }
        }

        return $commissions;
    }

    private function addCommission(int $affiliateId, float $amount, int $invoiceId, string $description): void
    {
        $schema = Capsule::schema();
        $historyTable = null;
        if ($schema->hasTable('tblaffiliateshistory')) {
            $historyTable = 'tblaffiliateshistory';
        } elseif ($schema->hasTable('tblaffiliatestransactions')) {
            // Backward compatibility for custom WHMCS schemas.
            $historyTable = 'tblaffiliatestransactions';
        }

        if ($historyTable !== null) {
            $payload = [
                'affiliateid' => $affiliateId,
                'date' => \date('Y-m-d H:i:s'),
                'description' => $description . ' invoice #' . $invoiceId,
                'amount' => $amount,
            ];

            // Some WHMCS schemas require this column.
            if ($schema->hasColumn($historyTable, 'affaccid')) {
                $payload['affaccid'] = 0;
            }

            Capsule::table($historyTable)->insert($payload);
        }

        Capsule::table('tblaffiliates')
            ->where('id', $affiliateId)
            ->update([
                'balance' => Capsule::raw('balance + ' . (float) $amount),
            ]);
    }
}
