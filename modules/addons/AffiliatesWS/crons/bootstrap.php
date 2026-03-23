<?php

declare(strict_types=1);

function getWhmcsInitPath()
{
    $whmcsPath = \sprintf('%s/', \dirname(__DIR__));
    $configFilePath = \sprintf('%s/config.php', __DIR__);

    if (\file_exists($configFilePath)) {
        require $configFilePath;
    }

    if (isset($whmcsPath) && \is_string($whmcsPath) && $whmcsPath !== '') {
        $path = \realpath(\sprintf('%s/init.php', $whmcsPath));
    } else {
        $path = false;
    }

    if ($path === false) {
        throw new \Exception('Unable to determine WHMCS init.php path');
    }

    return $path;
}

require_once getWhmcsInitPath();
