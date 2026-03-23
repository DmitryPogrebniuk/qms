<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Database;

use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Database\Migrations\AbstractMigration;

final class SchemaManager
{
    public function runMigrations(): void
    {
        $this->ensureMigrationsTable();

        $migrations = $this->collectMigrations();
        \usort($migrations, static fn (AbstractMigration $a, AbstractMigration $b): int => $a->getVersion() <=> $b->getVersion());

        $executed = Capsule::table('aws_migrations')->pluck('version')->map(static fn ($v): int => (int) $v)->all();
        $executedMap = \array_flip($executed);

        foreach ($migrations as $migration) {
            if (isset($executedMap[$migration->getVersion()])) {
                continue;
            }

            $migration->up();
            Capsule::table('aws_migrations')->insert([
                'version' => $migration->getVersion(),
                'name' => $migration->getName(),
                'executed_at' => \date('Y-m-d H:i:s'),
            ]);
        }
    }

    private function ensureMigrationsTable(): void
    {
        $schema = Capsule::schema();
        if (!$schema->hasTable('aws_migrations')) {
            $schema->create('aws_migrations', static function ($table): void {
                $table->increments('id');
                $table->unsignedInteger('version')->unique();
                $table->string('name');
                $table->timestamp('executed_at')->useCurrent();
            });
        }
    }

    /** @return list<AbstractMigration> */
    private function collectMigrations(): array
    {
        $files = \glob(__DIR__ . '/Migrations/Migration_*.php') ?: [];
        $migrations = [];

        foreach ($files as $file) {
            require_once $file;
            $class = 'WHMCS\\Module\\Addon\\AffiliatesWS\\Database\\Migrations\\' . \basename($file, '.php');
            if (\class_exists($class)) {
                $instance = new $class();
                if ($instance instanceof AbstractMigration) {
                    $migrations[] = $instance;
                }
            }
        }

        return $migrations;
    }
}
