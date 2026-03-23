<?php

declare(strict_types=1);

require_once \sprintf('%s/bootstrap.php', __DIR__);
require_once ROOTDIR . '/modules/addons/AffiliatesWS/lib/Bootstrap.php';

\WHMCS\Module\Addon\AffiliatesWS\Bootstrap::boot();
\WHMCS\Module\Addon\AffiliatesWS\Core\CronEngine::getInstance()->tasks();
