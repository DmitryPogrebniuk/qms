<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Database\Migrations;

use Illuminate\Database\Schema\Blueprint;

final class Migration_001_InitialSchema extends AbstractMigration
{
    public function getVersion(): int
    {
        return 1;
    }

    public function getName(): string
    {
        return 'Initial schema';
    }

    public function up(): void
    {
        $schema = $this->schema();

        if (!$schema->hasTable('aws_affiliate_tiers')) {
            $schema->create('aws_affiliate_tiers', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('affiliate_id')->unique();
                $table->enum('tier', ['starter', 'bronze', 'silver', 'gold', 'platinum'])->default('starter');
                $table->unsignedInteger('active_services')->default(0);
                $table->decimal('weighted_score', 12, 2)->default(0);
                $table->timestamp('last_recalc_at')->nullable();
                $table->timestamps();
                $table->index('tier');
            });
        }

        if (!$schema->hasTable('aws_affiliate_tree')) {
            $schema->create('aws_affiliate_tree', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('affiliate_id');
                $table->unsignedInteger('parent_affiliate_id')->nullable();
                $table->unsignedInteger('grandparent_affiliate_id')->nullable();
                $table->unsignedInteger('client_id')->nullable();
                $table->enum('type', ['referral', 'sub_affiliate']);
                $table->timestamps();
                $table->index('affiliate_id');
                $table->index('parent_affiliate_id');
                $table->index('grandparent_affiliate_id');
                $table->index('client_id');
            });
        }

        if (!$schema->hasTable('aws_commission_tasks')) {
            $schema->create('aws_commission_tasks', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('invoice_id');
                $table->unsignedInteger('client_id');
                $table->unsignedInteger('hosting_id')->nullable();
                $table->decimal('amount', 12, 2);
                $table->enum('status', ['waiting', 'running', 'error', 'done'])->default('waiting');
                $table->unsignedInteger('attempts')->default(0);
                $table->text('payload')->nullable();
                $table->text('last_error')->nullable();
                $table->text('commissions_json')->nullable();
                $table->timestamp('locked_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index('status');
                $table->index(['status', 'locked_at']);
                $table->index('invoice_id');
            });
        }

        if (!$schema->hasTable('aws_commission_task_logs')) {
            $schema->create('aws_commission_task_logs', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('task_id');
                $table->unsignedInteger('attempt')->default(1);
                $table->enum('result', ['success', 'error']);
                $table->text('message')->nullable();
                $table->text('details')->nullable();
                $table->timestamps();
                $table->index('task_id');
            });
        }

        if (!$schema->hasTable('aws_affiliate_payouts')) {
            $schema->create('aws_affiliate_payouts', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('affiliate_id');
                $table->decimal('amount', 12, 2);
                $table->enum('status', ['pending', 'processing', 'paid', 'rejected'])->default('pending');
                $table->string('payment_method', 50)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index('affiliate_id');
                $table->index('status');
            });
        }

        if (!$schema->hasTable('aws_migrations')) {
            $schema->create('aws_migrations', static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('version')->unique();
                $table->string('name');
                $table->timestamp('executed_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        // Data is kept on module uninstall by design.
    }
}
