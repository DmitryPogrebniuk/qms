<?php

declare(strict_types=1);

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Models\CommissionTask;
use WHMCS\Module\Addon\AffiliatesWS\Services\AffiliateRelationResolver;

add_hook('InvoicePaid', 1, static function (array $vars): void {
    try {
        $invoiceId = (int) ($vars['invoiceid'] ?? 0);
        if ($invoiceId <= 0) {
            return;
        }

        $invoice = Capsule::table('tblinvoices')->where('id', $invoiceId)->first();
        if (!$invoice) {
            return;
        }

        $clientId = (int) $invoice->userid;
        $affiliateId = (new AffiliateRelationResolver())->getClientReferrerAffiliateId($clientId);
        if ($affiliateId <= 0) {
            return;
        }

        $items = Capsule::table('tblinvoiceitems')
            ->where('invoiceid', $invoiceId)
            ->where('type', 'Hosting')
            ->get();

        foreach ($items as $item) {
            $hostingId = (int) $item->relid;
            $exists = CommissionTask::query()
                ->where('invoice_id', $invoiceId)
                ->where('hosting_id', $hostingId)
                ->exists();
            if ($exists) {
                continue;
            }

            CommissionTask::query()->create([
                'invoice_id' => $invoiceId,
                'client_id' => $clientId,
                'hosting_id' => $hostingId,
                'amount' => (float) $item->amount,
                'status' => CommissionTask::STATUS_WAITING,
                'payload' => \json_encode([
                    'invoice_id' => $invoiceId,
                    'client_id' => $clientId,
                    'hosting_id' => $hostingId,
                    'amount' => (float) $item->amount,
                    'affiliate_id' => $affiliateId,
                ]),
            ]);
        }
    } catch (\Throwable $e) {
        logActivity('AffiliatesWS InvoicePaid hook error: ' . $e->getMessage());
    }
});
