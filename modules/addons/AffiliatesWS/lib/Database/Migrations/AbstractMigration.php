<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Database\Migrations;

use Illuminate\Database\Schema\Builder;
use WHMCS\Database\Capsule;

abstract class AbstractMigration
{
    abstract public function getVersion(): int;

    abstract public function getName(): string;

    abstract public function up(): void;

    abstract public function down(): void;

    protected function schema(): Builder
    {
        return Capsule::schema();
    }
}
