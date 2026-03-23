<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Database\Migrations;

final class Migration_002_AddExtendedFields extends AbstractMigration
{
    public function getVersion(): int
    {
        return 2;
    }

    public function getName(): string
    {
        return 'Add extended indexes and fields';
    }

    public function up(): void
    {
        $schema = $this->schema();

        if ($schema->hasTable('aws_affiliate_tree') && !$schema->hasColumn('aws_affiliate_tree', 'updated_at')) {
            $schema->table('aws_affiliate_tree', static function ($table): void {
                $table->timestamp('updated_at')->nullable();
            });
        }

        if ($schema->hasTable('aws_commission_task_logs')) {
            $schema->table('aws_commission_task_logs', static function ($table): void {
                // Placeholder migration version for forward compatibility.
            });
        }
    }

    public function down(): void
    {
        // No destructive rollback.
    }
}
