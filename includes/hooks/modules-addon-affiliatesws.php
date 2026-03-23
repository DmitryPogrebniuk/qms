<?php

declare(strict_types=1);

if (!\defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

require_once ROOTDIR . '/modules/addons/AffiliatesWS/lib/Bootstrap.php';
\WHMCS\Module\Addon\AffiliatesWS\Bootstrap::boot();

if (\defined('CLIENTAREA') && !\function_exists('modulesAddonAffiliatesWS')) {
    function modulesAddonAffiliatesWS(): void
    {
        \WHMCS\Utility\Bootstrap\AbstractBootstrap::registerServices(\DI::make('di'), [
            \WHMCS\Module\Addon\AffiliatesWS\Providers\AffiliatesServiceProvider::class,
        ]);
    }

    modulesAddonAffiliatesWS();
}
