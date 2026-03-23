<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Models;

use Illuminate\Database\Eloquent\Model;

class CommissionTaskLog extends Model
{
    protected $table = 'aws_commission_task_logs';

    protected $fillable = [
        'task_id',
        'attempt',
        'result',
        'message',
        'details',
    ];
}
