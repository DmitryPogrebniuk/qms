<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Views;

use WHMCS\Module\Addon\AffiliatesWS\Lang\AddonLang;

class AffiliatesViewStats extends \WHMCS\ClientArea
{
    protected function initializeView(): void
    {
        parent::initializeView();
        $this->setPageTitle(AddonLang::trans('affiliatesws_stats_title'));
        $this->setDisplayTitle(AddonLang::trans('affiliatesws_stats_title'));
        $this->setTemplate('/modules/addons/AffiliatesWS/templates/clientarea/affiliates_stats.tpl');
        $this->addToBreadCrumb('index.php', 'Home')
            ->addToBreadCrumb(\routePath('affiliatesws-index'), AddonLang::trans('affiliatesws_title'))
            ->addToBreadCrumb(\routePath('affiliatesws-stats'), AddonLang::trans('affiliatesws_stats_title'));
        $this->requireLogin();
        $this->assign('_lang', AddonLang::all());
    }
}
