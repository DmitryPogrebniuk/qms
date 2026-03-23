# AffiliatesWS

WHMCS addon module for multi-level affiliate commissions (L1/L2/L3), tier management by active services, async task queue, admin dashboard, and client area routes.

## Installation

1. Copy module into `modules/addons/AffiliatesWS`.
2. Register hook file in `includes/hooks/modules-addon-affiliatesws.php`.
3. Run `composer dump-autoload` in module directory.
4. Activate module in WHMCS admin area.
5. Configure cron:
   - `*/5 * * * * php -q /path/to/whmcs/modules/addons/AffiliatesWS/crons/tasks.php`

## Notes

- Module keeps all data on deactivation.
- Migrations are idempotent and tracked in `aws_migrations`.
- Hooks are dynamically loaded from `lib/Hooks`.
