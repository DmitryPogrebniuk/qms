<?php

declare(strict_types=1);

namespace WHMCS\Module\Addon\AffiliatesWS\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class CommissionTask extends Model
{
    public const STATUS_WAITING = 'waiting';
    public const STATUS_RUNNING = 'running';
    public const STATUS_ERROR = 'error';
    public const STATUS_DONE = 'done';

    protected $table = 'aws_commission_tasks';

    protected $fillable = [
        'invoice_id',
        'client_id',
        'hosting_id',
        'amount',
        'status',
        'attempts',
        'payload',
        'last_error',
        'commissions_json',
        'locked_at',
        'completed_at',
    ];

    /** @return Collection<int, self> */
    public static function lockBatch(int $limit): Collection
    {
        $candidates = self::query()
            ->where('status', self::STATUS_WAITING)
            ->orderBy('id')
            ->limit($limit)
            ->get();

        if ($candidates->isEmpty()) {
            return new Collection();
        }

        $ids = $candidates->pluck('id')->all();
        self::query()
            ->whereIn('id', $ids)
            ->where('status', self::STATUS_WAITING)
            ->update([
                'status' => self::STATUS_RUNNING,
                'locked_at' => \date('Y-m-d H:i:s'),
                'updated_at' => \date('Y-m-d H:i:s'),
            ]);

        return self::query()->whereIn('id', $ids)->get();
    }
}
