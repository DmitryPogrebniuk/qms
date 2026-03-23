{if !$is_affiliate}
    <div class="alert alert-info">{$_lang.affiliatesws_not_affiliate}</div>
{else}
    <div class="row">
        <div class="col-md-3"><div class="panel panel-default"><div class="panel-heading">{$_lang.affiliatesws_your_tier}</div><div class="panel-body">{$tier_info->tier|default:'starter'}</div></div></div>
        <div class="col-md-3"><div class="panel panel-default"><div class="panel-heading">{$_lang.affiliatesws_active_services}</div><div class="panel-body">{$tier_info->active_services|default:0}</div></div></div>
        <div class="col-md-3"><div class="panel panel-default"><div class="panel-heading">{$_lang.affiliatesws_balance}</div><div class="panel-body">{$balance|number_format:2}</div></div></div>
        <div class="col-md-3"><div class="panel panel-default"><div class="panel-heading">{$_lang.affiliatesws_referrals}</div><div class="panel-body">{$referral_count|default:0}</div></div></div>
    </div>

    <h4>{$_lang.affiliatesws_tier_table}</h4>
    <table class="table table-striped">
        <thead><tr><th>Tier</th><th>Status</th></tr></thead>
        <tbody>
        {foreach from=$all_tiers item=tier}
            <tr {if $tier_info && $tier_info->tier eq $tier}class="success"{/if}>
                <td>{$tier|capitalize}</td>
                <td>{if $tier_info && $tier_info->tier eq $tier}Current{else}-{/if}</td>
            </tr>
        {/foreach}
        </tbody>
    </table>

    <p><a href="{routePath('affiliatesws-stats')}" class="btn btn-default">{$_lang.affiliatesws_view_stats}</a></p>

    <form action="{routePath('affiliatesws-request-payout')}" method="post">
        <button type="submit" class="btn btn-primary">{$_lang.affiliatesws_request_payout}</button>
    </form>

    <h4>{$_lang.affiliatesws_recent_commissions}</h4>
    <table class="table table-striped">
        <thead><tr><th>Date</th><th>Amount</th><th>Description</th></tr></thead>
        <tbody>
        {foreach from=$commissions item=row}
            <tr>
                <td>{$row->date}</td>
                <td>{$row->amount}</td>
                <td>{$row->description}</td>
            </tr>
        {foreachelse}
            <tr><td colspan="3">No data</td></tr>
        {/foreach}
        </tbody>
    </table>
{/if}
