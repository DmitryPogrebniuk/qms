<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Core;

use WHMCS\Database\Capsule;

final class ModuleConfig
{
    /** @return array<string, string> */
    public static function all(): array
    {
        $rows = Capsule::table('tbladdonmodules')
            ->where('module', 'AffiliatesWS')
            ->pluck('value', 'setting');

        $result = [];
        foreach ($rows as $key => $value) {
            $result[(string) $key] = (string) $value;
        }

        return $result;
    }

    public static function getInt(string $key, int $default): int
    {
        $value = self::all()[$key] ?? null;
        return \is_numeric($value) ? (int) $value : $default;
    }

    public static function getFloat(string $key, float $default): float
    {
        $value = self::all()[$key] ?? null;
        return \is_numeric($value) ? (float) $value : $default;
    }
}
