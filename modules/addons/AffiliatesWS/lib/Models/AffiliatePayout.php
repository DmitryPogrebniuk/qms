<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliatePayout extends Model
{
    protected $table = 'aws_affiliate_payouts';

    protected $fillable = [
        'affiliate_id',
        'amount',
        'status',
        'payment_method',
        'notes',
    ];
}
