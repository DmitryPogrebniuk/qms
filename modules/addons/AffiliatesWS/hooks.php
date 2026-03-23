<?php

declare(strict_types=1);

if (!\defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

use WHMCS\Module\Addon\AffiliatesWS\Bootstrap;

Bootstrap::boot();

$loadDir = static function (string $path): void {
    foreach (\glob($path . '/*.php') ?: [] as $file) {
        require_once $file;
    }
};

if (\defined('ADMINAREA')) {
    $loadDir(__DIR__ . '/lib/Hooks/Admin');
}

if (\defined('CLIENTAREA')) {
    $loadDir(__DIR__ . '/lib/Hooks/Client');
}

$loadDir(__DIR__ . '/lib/Hooks/Universal');
