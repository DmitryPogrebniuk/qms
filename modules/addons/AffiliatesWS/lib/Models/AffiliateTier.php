<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliateTier extends Model
{
    protected $table = 'aws_affiliate_tiers';

    protected $fillable = [
        'affiliate_id',
        'tier',
        'active_services',
        'weighted_score',
        'last_recalc_at',
    ];
}
