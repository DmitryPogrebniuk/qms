<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Services;

use WHMCS\Database\Capsule;

final class AffiliateRelationResolver
{
    public function getClientReferrerAffiliateId(int $clientId): int
    {
        $schema = Capsule::schema();

        if ($schema->hasTable('tblclients')) {
            foreach (['affiliateid', 'affiliate_id'] as $column) {
                if ($schema->hasColumn('tblclients', $column)) {
                    return (int) (Capsule::table('tblclients')->where('id', $clientId)->value($column) ?? 0);
                }
            }
        }

        if ($schema->hasTable('tblaffiliates_referrers')) {
            $affColumn = $this->firstExistingColumn('tblaffiliates_referrers', ['affiliateid', 'affiliate_id']);
            $clientColumn = $this->firstExistingColumn('tblaffiliates_referrers', ['clientid', 'referrerid', 'userid', 'relid']);
            if ($affColumn !== null && $clientColumn !== null) {
                return (int) (Capsule::table('tblaffiliates_referrers')->where($clientColumn, $clientId)->value($affColumn) ?? 0);
            }
        }

        return 0;
    }

    /**
     * @return array<int>
     */
    public function getReferredClientIds(int $affiliateId): array
    {
        $schema = Capsule::schema();

        if ($schema->hasTable('tblclients')) {
            foreach (['affiliateid', 'affiliate_id'] as $column) {
                if ($schema->hasColumn('tblclients', $column)) {
                    return Capsule::table('tblclients')
                        ->where($column, $affiliateId)
                        ->pluck('id')
                        ->map(static fn ($id): int => (int) $id)
                        ->all();
                }
            }
        }

        if ($schema->hasTable('tblaffiliates_referrers')) {
            $affColumn = $this->firstExistingColumn('tblaffiliates_referrers', ['affiliateid', 'affiliate_id']);
            $clientColumn = $this->firstExistingColumn('tblaffiliates_referrers', ['clientid', 'referrerid', 'userid', 'relid']);
            if ($affColumn !== null && $clientColumn !== null) {
                return Capsule::table('tblaffiliates_referrers')
                    ->where($affColumn, $affiliateId)
                    ->pluck($clientColumn)
                    ->map(static fn ($id): int => (int) $id)
                    ->all();
            }
        }

        return [];
    }

    private function firstExistingColumn(string $table, array $candidates): ?string
    {
        $schema = Capsule::schema();
        foreach ($candidates as $column) {
            if ($schema->hasColumn($table, $column)) {
                return $column;
            }
        }

        return null;
    }
}
