<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS;

final class Bootstrap
{
    private static bool $booted = false;

    public static function boot(): void
    {
        if (self::$booted) {
            return;
        }

        $rootPath = \dirname(__DIR__);
        $vendorAutoload = $rootPath . '/vendor/autoload.php';

        if (\is_file($vendorAutoload)) {
            require_once $vendorAutoload;
        }

        \spl_autoload_register(static function (string $class): void {
            $prefix = 'WHMCS\\Module\\Addon\\AffiliatesWS\\';
            if (\strncmp($class, $prefix, \strlen($prefix)) !== 0) {
                return;
            }

            $relative = \substr($class, \strlen($prefix));
            $path = __DIR__ . '/' . \str_replace('\\', '/', $relative) . '.php';
            if (\is_file($path)) {
                require_once $path;
            }
        });

        self::$booted = true;
    }
}
