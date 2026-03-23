<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Http;

use WHMCS\Http\Message\ServerRequest;

final class ServerRequestValidator
{
    public function validate(ServerRequest $request): void
    {
        $this->validateQueryParams($request);
    }

    public function validateQueryParams(ServerRequest $request): void
    {
        $query = $request->getQueryParams();
        if (!\is_array($query)) {
            throw new \InvalidArgumentException('Invalid request query params');
        }

        if (!isset($query['page'])) {
            return;
        }

        $page = $query['page'];
        if (\is_array($page) || !\is_scalar($page) || !\preg_match('/^[1-9][0-9]*$/', (string) $page)) {
            throw new \InvalidArgumentException('Invalid "page" query param');
        }
    }
}
