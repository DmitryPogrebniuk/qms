<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Controllers;

use WHMCS\Http\Message\ServerRequest;
use WHMCS\Database\Capsule;
use WHMCS\Module\Addon\AffiliatesWS\Http\ServerRequestValidator;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTier;
use WHMCS\Module\Addon\AffiliatesWS\Models\AffiliateTree;
use WHMCS\Module\Addon\AffiliatesWS\Services\PayoutProcessor;
use WHMCS\Module\Addon\AffiliatesWS\Services\TierManager;
use WHMCS\Module\Addon\AffiliatesWS\Views\AffiliatesViewIndex;
use WHMCS\Module\Addon\AffiliatesWS\Views\AffiliatesViewStats;
use WHMCS\User\Client;

final class AffiliatesController
{
    private ServerRequestValidator $requestValidator;

    public function __construct(?ServerRequestValidator $requestValidator = null)
    {
        $this->requestValidator = $requestValidator ?? new ServerRequestValidator();
    }

    public function index(ServerRequest $request): \WHMCS\ClientArea
    {
        $this->requestValidator->validate($request);

        $view = new AffiliatesViewIndex();
        $user = \WHMCS\Session::get('uid') ? Client::find(\WHMCS\Session::get('uid')) : null;

        $affiliateId = $user ? (int) Capsule::table('tblaffiliates')->where('clientid', $user->id)->value('id') : 0;
        $isAffiliate = $affiliateId > 0;
        $tierModel = $isAffiliate ? AffiliateTier::query()->where('affiliate_id', $affiliateId)->first() : null;
        if ($isAffiliate && !$tierModel) {
            $tierModel = (new TierManager())->recalculate($affiliateId);
        }

        $view->assign('is_affiliate', $isAffiliate);
        $view->assign('affiliate_id', $affiliateId);
        $view->assign('tier_info', $tierModel);
        $view->assign('all_tiers', ['starter', 'bronze', 'silver', 'gold', 'platinum']);
        $view->assign('all_rates', (new TierManager())->getRates($tierModel->tier ?? 'starter'));
        $view->assign('balance', (float) Capsule::table('tblaffiliates')->where('id', $affiliateId)->value('balance'));
        $view->assign('referral_count', (int) AffiliateTree::query()->where('affiliate_id', $affiliateId)->where('type', 'referral')->count());
        $view->assign('sub_affiliate_count', (int) AffiliateTree::query()->where('parent_affiliate_id', $affiliateId)->where('type', 'sub_affiliate')->count());
        $commissionsTable = $this->getCommissionsTable();
        $commissions = $commissionsTable
            ? Capsule::table($commissionsTable)->where('affiliateid', $affiliateId)->orderByDesc('id')->limit(10)->get()
            : [];
        $view->assign('commissions', $commissions);
        $view->assign('payouts', Capsule::table('aws_affiliate_payouts')->where('affiliate_id', $affiliateId)->orderByDesc('id')->limit(10)->get());

        return $view;
    }

    public function stats(ServerRequest $request): \WHMCS\ClientArea
    {
        $this->requestValidator->validate($request);

        $view = new AffiliatesViewStats();
        $user = \WHMCS\Session::get('uid') ? Client::find(\WHMCS\Session::get('uid')) : null;
        $affiliateId = $user ? (int) Capsule::table('tblaffiliates')->where('clientid', $user->id)->value('id') : 0;

        $l1 = (int) AffiliateTree::query()->where('affiliate_id', $affiliateId)->where('type', 'referral')->count();
        $l2 = (int) AffiliateTree::query()->where('parent_affiliate_id', $affiliateId)->where('type', 'referral')->count();
        $l3 = (int) AffiliateTree::query()->where('grandparent_affiliate_id', $affiliateId)->where('type', 'referral')->count();
        $commissionsTable = $this->getCommissionsTable();
        $sum = $commissionsTable ? (float) Capsule::table($commissionsTable)->where('affiliateid', $affiliateId)->sum('amount') : 0.0;

        $view->assign('l1_count', $l1);
        $view->assign('l2_count', $l2);
        $view->assign('l3_count', $l3);
        $view->assign('commission_total', $sum);

        return $view;
    }

    public function requestPayout(ServerRequest $request): \WHMCS\ClientArea
    {
        $this->requestValidator->validate($request);

        $user = \WHMCS\Session::get('uid') ? Client::find(\WHMCS\Session::get('uid')) : null;
        $affiliateId = $user ? (int) Capsule::table('tblaffiliates')->where('clientid', $user->id)->value('id') : 0;

        if (\strtoupper($request->getMethod()) === 'POST') {
            check_token();
            (new PayoutProcessor())->requestPayout($affiliateId);
            \header('Location: ' . \routePath('affiliatesws-index'));
            exit;
        }

        return $this->index($request);
    }

    private function getCommissionsTable(): ?string
    {
        $schema = Capsule::schema();
        if ($schema->hasTable('tblaffiliateshistory')) {
            return 'tblaffiliateshistory';
        }
        if ($schema->hasTable('tblaffiliatestransactions')) {
            return 'tblaffiliatestransactions';
        }

        return null;
    }
}
