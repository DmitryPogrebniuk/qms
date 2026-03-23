<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Lang;

final class AddonLang
{
    /** @var array<string, string>|null */
    private static ?array $cache = null;

    /** @return array<string, string> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $langFile = \dirname(__DIR__, 2) . '/lang/english.php';
        $translations = [];

        if (\is_file($langFile)) {
            $_ADDONLANG = [];
            /** @noinspection PhpIncludeInspection */
            require $langFile;
            if (\is_array($_ADDONLANG)) {
                foreach ($_ADDONLANG as $key => $value) {
                    $translations[(string) $key] = (string) $value;
                }
            }
        }

        self::$cache = $translations;
        return self::$cache;
    }

    public static function trans(string $key): string
    {
        $all = self::all();
        return $all[$key] ?? $key;
    }
}
