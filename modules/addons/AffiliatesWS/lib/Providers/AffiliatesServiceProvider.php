<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Providers;

use FastRoute\RouteCollector;
use WHMCS\Module\Addon\AffiliatesWS\Controllers\AffiliatesController;

class AffiliatesServiceProvider extends \WHMCS\Application\Support\ServiceProvider\AbstractServiceProvider implements \WHMCS\Route\Contracts\ProviderInterface
{
    use \WHMCS\Route\ProviderTrait;

    /** @return array<string, array<int, array<string, mixed>>> */
    public function getRoutes(): array
    {
        return [
            '/user' => [
                [
                    'name' => 'affiliatesws-index',
                    'method' => ['GET'],
                    'path' => '/affiliates',
                    'handle' => [AffiliatesController::class, 'index'],
                ],
                [
                    'name' => 'affiliatesws-stats',
                    'method' => ['GET'],
                    'path' => '/affiliates/stats',
                    'handle' => [AffiliatesController::class, 'stats'],
                ],
                [
                    'name' => 'affiliatesws-request-payout',
                    'method' => ['GET', 'POST'],
                    'path' => '/affiliates/payout',
                    'handle' => [AffiliatesController::class, 'requestPayout'],
                ],
            ],
        ];
    }

    public function registerRoutes(RouteCollector $routeCollector): void
    {
        $this->addRouteGroups($routeCollector, $this->getRoutes());
    }

    public function register(): void
    {
        // Required by interface.
    }
}
