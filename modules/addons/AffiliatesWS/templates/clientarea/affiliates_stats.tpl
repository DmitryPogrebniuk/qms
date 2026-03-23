<h2>{$_lang.affiliatesws_stats_title}</h2>

<div class="row">
    <div class="col-md-4"><div class="panel panel-default"><div class="panel-heading">L1 Referrals</div><div class="panel-body">{$l1_count|default:0}</div></div></div>
    <div class="col-md-4"><div class="panel panel-default"><div class="panel-heading">L2 Referrals</div><div class="panel-body">{$l2_count|default:0}</div></div></div>
    <div class="col-md-4"><div class="panel panel-default"><div class="panel-heading">L3 Referrals</div><div class="panel-body">{$l3_count|default:0}</div></div></div>
</div>

<div class="alert alert-info">Total Commissions: {$commission_total|number_format:2}</div>
<a class="btn btn-default" href="{routePath('affiliatesws-index')}">Back to Dashboard</a>
