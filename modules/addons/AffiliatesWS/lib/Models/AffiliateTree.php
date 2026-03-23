<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliateTree extends Model
{
    protected $table = 'aws_affiliate_tree';

    protected $fillable = [
        'affiliate_id',
        'parent_affiliate_id',
        'grandparent_affiliate_id',
        'client_id',
        'type',
    ];
}
