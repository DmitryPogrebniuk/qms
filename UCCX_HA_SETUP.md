# UCCX High Availability (HA) Setup Guide

This guide explains how to configure QMS to work with Cisco UCCX deployed in High Availability (HA) mode with automatic failover.

## Overview

Cisco UCCX HA typically consists of:
- **Primary Node**: Main UCCX server handling requests
- **Secondary Node**: Standby server for failover
- **Database Replication**: Real-time data sync between nodes

QMS supports UCCX HA with:
- ✅ Automatic failover between nodes
- ✅ Round-robin load distribution
- ✅ Exponential backoff retry mechanism
- ✅ Configurable timeout and retry attempts
- ✅ Health monitoring and logging

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    QMS Application                       │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │   UCCX Integration Service                   │      │
│  │   - Directory Sync                           │      │
│  │   - Historical Stats                         │      │
│  │   - Automatic Failover                       │      │
│  └──────────────────────────────────────────────┘      │
│              │                    │                      │
│              │                    │                      │
└──────────────┼────────────────────┼──────────────────────┘
               │                    │
               ▼                    ▼
    ┌──────────────────┐  ┌──────────────────┐
    │  UCCX Primary    │  │ UCCX Secondary   │
    │  Node 1          │  │ Node 2           │
    │  10.1.1.10:8443  │  │ 10.1.1.11:8443   │
    └──────────────────┘  └──────────────────┘
               │                    │
               └────────┬───────────┘
                        │
                ┌───────▼────────┐
                │  UCCX Database │
                │  (Replicated)  │
                └────────────────┘
```

## Configuration

### Environment Variables

Edit your `.env` or `.env.production` file:

```env
# UCCX High Availability Configuration
# Format: host1:port1,host2:port2 or host1,host2 (default port 8443)
UCCX_NODES=uccx-primary.example.com:8443,uccx-secondary.example.com:8443

# Authentication (same credentials for all nodes)
UCCX_USERNAME=admin
UCCX_PASSWORD=SecurePassword123!

# Failover Settings
UCCX_TIMEOUT_MS=30000          # Request timeout (30 seconds)
UCCX_RETRY_ATTEMPTS=2          # Number of retry attempts per node
UCCX_SYNC_INTERVAL_SECONDS=600 # Sync interval (10 minutes)
```

### Configuration Examples

#### Single Node (No HA)
```env
UCCX_NODES=uccx.company.com:8443
```

#### Two-Node HA
```env
UCCX_NODES=uccx1.company.com:8443,uccx2.company.com:8443
```

#### Three-Node Cluster
```env
UCCX_NODES=uccx1.dc1.com:8443,uccx2.dc1.com:8443,uccx3.dc2.com:8443
```

#### Using Default Port (8443)
```env
UCCX_NODES=uccx1.company.com,uccx2.company.com
```

#### Mixed Ports
```env
UCCX_NODES=uccx1.company.com:8443,uccx2.company.com:9443
```

## Failover Behavior

### How It Works

1. **Initial Request**: QMS connects to the first node in the list
2. **Round-Robin**: Distributes requests across all nodes
3. **Failure Detection**: Detects timeouts or connection errors
4. **Automatic Failover**: Switches to next node in rotation
5. **Exponential Backoff**: Waits progressively longer between retries
6. **Health Logging**: Records node failures and successes

### Failover Sequence

```
Attempt 1: Primary Node (uccx1)
  └─ Timeout after 30s → Fail

Attempt 2: Secondary Node (uccx2)
  └─ Success → Continue

Next Request: Secondary Node (uccx2)
  └─ Maintains last successful node
```

### Retry Logic

- **First Attempt**: Try current node
- **Retry 1**: Wait 1 second, try next node
- **Retry 2**: Wait 2 seconds, try next node  
- **Retry 3**: Wait 4 seconds, try next node
- **Max Wait**: 10 seconds (exponential backoff cap)

If all nodes fail after all retries:
```
Error: UCCX HA cluster unavailable: All 2 nodes failed
```

## Network Requirements

### Firewall Rules

Ensure QMS server can reach all UCCX nodes:

```bash
# From QMS server
telnet uccx-primary.company.com 8443
telnet uccx-secondary.company.com 8443

# Test HTTPS connectivity
curl -k https://uccx-primary.company.com:8443
curl -k https://uccx-secondary.company.com:8443
```

### Required Ports

| Source | Destination | Port | Protocol | Purpose |
|--------|------------|------|----------|---------|
| QMS API | UCCX Nodes | 8443 | HTTPS | Directory sync, stats |
| QMS API | UCCX Nodes | 443 | HTTPS | Alternative port |

## Monitoring

### Log Messages

**Successful Connection:**
```
[UCCXDirectorySyncService] Successfully fetched from UCCX node: uccx-primary.company.com
```

**Node Failure:**
```
[UCCXDirectorySyncService] UCCX node uccx-primary.company.com failed for /teams: ETIMEDOUT
```

**Failover Event:**
```
[UCCXDirectorySyncService] Attempting UCCX request to https://uccx-secondary.company.com:8443/teams (attempt 2)
```

**Complete Failure:**
```
[UCCXDirectorySyncService] All UCCX nodes failed for /teams after 4 attempts
```

### Monitoring Queries

Check sync status in database:

```sql
-- View sync state
SELECT * FROM "SyncState" WHERE "syncType" LIKE 'uccx%';

-- Check last successful sync
SELECT 
  "syncType",
  "status",
  "lastSyncedAt",
  "errorMessage"
FROM "SyncState"
WHERE "syncType" IN ('uccx_full', 'uccx_incremental')
ORDER BY "lastSyncedAt" DESC;
```

### Prometheus Metrics (Future)

```
uccx_node_requests_total{node="uccx1", status="success"}
uccx_node_requests_total{node="uccx1", status="failure"}
uccx_failover_events_total
uccx_sync_duration_seconds
```

## Troubleshooting

### All Nodes Failing

**Symptoms:**
```
Error: UCCX HA cluster unavailable: All 2 nodes failed
```

**Diagnosis:**
1. Check network connectivity:
   ```bash
   ping uccx-primary.company.com
   ping uccx-secondary.company.com
   ```

2. Verify UCCX services are running:
   ```bash
   # SSH to UCCX nodes
   utils service list | grep -i tomcat
   ```

3. Test API access manually:
   ```bash
   curl -k -u admin:password https://uccx-primary.company.com:8443/appadmin/api/v1/teams
   ```

4. Check credentials:
   ```bash
   # Verify in .env file
   grep UCCX_ apps/api/.env
   ```

### One Node Always Failing

**Symptoms:**
```
[UCCXDirectorySyncService] UCCX node uccx-secondary.company.com failed: ECONNREFUSED
```

**Solutions:**
1. Remove failing node from configuration:
   ```env
   # Before
   UCCX_NODES=uccx1.company.com:8443,uccx2.company.com:8443
   
   # After (single node)
   UCCX_NODES=uccx1.company.com:8443
   ```

2. Fix and restore node later
3. Restart QMS API:
   ```bash
   docker-compose -f infra/docker-compose.yml restart api
   ```

### Slow Failover

**Symptoms:**
- Long delays during sync
- Timeouts taking too long

**Solutions:**
1. Reduce timeout:
   ```env
   UCCX_TIMEOUT_MS=10000  # 10 seconds instead of 30
   ```

2. Reduce retry attempts:
   ```env
   UCCX_RETRY_ATTEMPTS=1  # Fail faster
   ```

3. Check network latency:
   ```bash
   ping -c 10 uccx-primary.company.com
   ```

### SSL Certificate Errors

**Symptoms:**
```
Error: unable to verify the first certificate
```

**Solutions:**
1. The code already handles self-signed certificates with:
   ```typescript
   rejectUnauthorized: false
   ```

2. For production, install proper certificates on UCCX nodes

## Testing Failover

### Manual Failover Test

1. **Check initial connection:**
   ```bash
   docker-compose logs api | grep "Successfully fetched from UCCX"
   ```

2. **Block primary node** (simulate failure):
   ```bash
   # On firewall/router
   iptables -A OUTPUT -d uccx-primary.company.com -j DROP
   ```

3. **Trigger sync manually:**
   ```bash
   # Wait for next sync or restart
   docker-compose restart api
   ```

4. **Verify failover:**
   ```bash
   docker-compose logs api | grep "UCCX node.*failed"
   docker-compose logs api | grep "Successfully fetched from UCCX"
   ```

5. **Restore primary:**
   ```bash
   iptables -D OUTPUT -d uccx-primary.company.com -j DROP
   ```

### Automated Testing

Create a test script:

```bash
#!/bin/bash
# test-uccx-failover.sh

echo "Testing UCCX HA failover..."

# Test each node individually
for node in $(echo $UCCX_NODES | tr ',' ' '); do
  echo "Testing $node..."
  curl -k -u $UCCX_USERNAME:$UCCX_PASSWORD \
    --connect-timeout 5 \
    https://$node/appadmin/api/v1/teams
  
  if [ $? -eq 0 ]; then
    echo "✅ $node is reachable"
  else
    echo "❌ $node is unreachable"
  fi
done
```

## Best Practices

### 1. Use DNS Load Balancing (Alternative)

Instead of application-level failover, use DNS:

```env
# Single hostname pointing to both nodes
UCCX_NODES=uccx.company.com:8443

# DNS round-robin:
# uccx.company.com → 10.1.1.10, 10.1.1.11
```

**Pros:**
- Simpler configuration
- Network-level load balancing

**Cons:**
- DNS caching may delay failover
- Less control over retry logic

### 2. Monitor Node Health

Set up monitoring alerts:
- Alert if all nodes fail
- Alert if one node consistently fails
- Track failover frequency

### 3. Regular Testing

Schedule monthly failover tests:
1. Disable primary node
2. Verify secondary takes over
3. Check sync continues
4. Restore primary
5. Verify load distribution

### 4. Document Your Setup

Keep records of:
- Node IP addresses and hostnames
- Failover test results
- Performance metrics
- Incident history

## Performance Considerations

### Node Selection Strategy

Current implementation: **Round-robin with sticky node**
- Uses last successful node first
- Rotates on failure

Alternative strategies (future):
- **Health-based**: Prefer fastest responding node
- **Weighted**: Prefer primary over secondary
- **Proximity**: Prefer closest node by latency

### Timeout Tuning

| Scenario | Timeout | Retry | Total Time |
|----------|---------|-------|------------|
| Local LAN | 5s | 1 | ~10s |
| Same DC | 15s | 2 | ~45s |
| Cross-DC | 30s | 2 | ~90s |

Choose based on network topology:
```env
# Fast local network
UCCX_TIMEOUT_MS=5000
UCCX_RETRY_ATTEMPTS=1

# Slower WAN
UCCX_TIMEOUT_MS=30000
UCCX_RETRY_ATTEMPTS=3
```

## Security

### Credentials Management

**Production:**
```bash
# Use environment variables from secure vault
export UCCX_USERNAME=$(vault kv get -field=username secret/uccx)
export UCCX_PASSWORD=$(vault kv get -field=password secret/uccx)
```

**Development:**
```bash
# Use .env file (never commit to git)
echo "UCCX_PASSWORD=..." >> apps/api/.env
```

### Network Security

- Use VPN/private network for UCCX connectivity
- Restrict firewall rules to QMS server IP only
- Rotate credentials regularly
- Use strong passwords (16+ characters)

## Support

For issues with UCCX HA configuration:

1. Check logs: `docker-compose logs api | grep UCCX`
2. Verify network: `telnet <uccx-node> 8443`
3. Test credentials: `curl -k -u user:pass https://<uccx-node>:8443`
4. Review documentation: [Cisco UCCX HA Documentation](https://www.cisco.com/c/en/us/support/customer-collaboration/unified-contact-center-express/products-installation-and-configuration-guides-list.html)

## References

- [Cisco UCCX Administration Guide](https://www.cisco.com/c/en/us/support/customer-collaboration/unified-contact-center-express/products-maintenance-guides-list.html)
- [UCCX High Availability Overview](https://www.cisco.com/c/en/us/td/docs/voice_ip_comm/cust_contact/contact_center/uccx/uccx_12_5/configuration/guide/uccx_b_125_config_admin/uccx_b_125_config_admin_chapter_0100.html)
- QMS Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Deployment Guide: [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Version**: 1.1.0  
**Last Updated**: January 2026  
**Tested with**: Cisco UCCX 12.5, 15.0
