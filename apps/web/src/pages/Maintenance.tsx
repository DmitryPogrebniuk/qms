import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  Card,
  CardContent,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Badge,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Collapse,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as RestartIcon,
  HealthAndSafety as HealthIcon,
  Article as LogsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as OkIcon,
  HelpOutline as UnknownIcon,
  RestartAlt as RestartAltIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  NotificationsActive as AlertIcon,
  History as HistoryIcon,
  BugReport as DiagnosticsIcon,
  Storage as DatabaseIcon,
  Cloud as IntegrationIcon,
  Web as WebIcon,
  Api as ApiIcon,
  Memory as WorkerIcon,
  Router as InfraIcon,
} from '@mui/icons-material';
import { useHttpClient } from '../hooks/useHttpClient';

// Types
interface ComponentMetrics {
  cpuUsage?: number;
  memoryUsagePercent?: number;
  uptimeSeconds?: number;
  requestsPerMinute?: number;
  errorRate?: number;
  avgLatencyMs?: number;
}

interface HealthCheck {
  id: string;
  name: string;
  checkType: string;
  lastStatus: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' | 'SKIPPED';
  lastValue?: number;
  lastMessage?: string;
  lastCheckedAt?: string;
}

interface SystemComponent {
  id: string;
  code: string;
  name: string;
  description?: string;
  componentType: string;
  status: 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'RESTARTING';
  statusReason?: string;
  lastHeartbeat?: string;
  lastHealthCheck?: string;
  version?: string;
  startedAt?: string;
  metrics?: ComponentMetrics;
  isCritical: boolean;
  isRestartable: boolean;
  restartMethod: string;
  healthChecks: HealthCheck[];
  activeAlertCount: number;
  recentActionCount: number;
}

interface MaintenanceAlert {
  id: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  isActive: boolean;
  isAcknowledged: boolean;
  triggeredAt: string;
  component?: { code: string; name: string };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source?: string;
}

interface MaintenanceAction {
  id: string;
  componentId: string;
  actionType: string;
  status: string;
  actorName?: string;
  reason?: string;
  requestedAt: string;
  finishedAt?: string;
  resultMessage?: string;
  component?: { code: string; name: string };
}

interface SystemOverview {
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  components: {
    total: number;
    OK: number;
    DEGRADED: number;
    DOWN: number;
    UNKNOWN: number;
    RESTARTING: number;
  };
  alerts: {
    total: number;
    CRITICAL: number;
    ERROR: number;
    WARNING: number;
    INFO: number;
  };
  lastUpdated: string;
}

// Status icon helpers
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'OK':
      return <OkIcon color="success" />;
    case 'DEGRADED':
      return <WarningIcon color="warning" />;
    case 'DOWN':
      return <ErrorIcon color="error" />;
    case 'RESTARTING':
      return <RestartAltIcon color="info" />;
    default:
      return <UnknownIcon color="disabled" />;
  }
};

const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (status) {
    case 'OK':
      return 'success';
    case 'DEGRADED':
      return 'warning';
    case 'DOWN':
    case 'CRITICAL':
      return 'error';
    case 'RESTARTING':
      return 'info';
    default:
      return 'default';
  }
};

const getComponentIcon = (type: string) => {
  switch (type) {
    case 'FRONTEND':
      return <WebIcon />;
    case 'BACKEND':
      return <ApiIcon />;
    case 'DATABASE':
      return <DatabaseIcon />;
    case 'SEARCH':
      return <SearchIcon />;
    case 'INTEGRATION':
      return <IntegrationIcon />;
    case 'WORKER':
      return <WorkerIcon />;
    case 'INFRASTRUCTURE':
      return <InfraIcon />;
    default:
      return <ApiIcon />;
  }
};

const getLogLevelColor = (level: string): 'default' | 'info' | 'warning' | 'error' => {
  switch (level) {
    case 'DEBUG':
      return 'default';
    case 'INFO':
      return 'info';
    case 'WARN':
      return 'warning';
    case 'ERROR':
    case 'FATAL':
      return 'error';
    default:
      return 'default';
  }
};

const formatUptime = (seconds?: number): string => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}д ${hours}г`;
  if (hours > 0) return `${hours}г ${mins}хв`;
  return `${mins}хв`;
};

const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('uk-UA');
};

// Main Component
export default function Maintenance() {
  const { t } = useTranslation();
  const http = useHttpClient();

  // State
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [components, setComponents] = useState<SystemComponent[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [actions, setActions] = useState<MaintenanceAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // Component detail
  const [selectedComponent, setSelectedComponent] = useState<SystemComponent | null>(null);
  const [componentDetailOpen, setComponentDetailOpen] = useState(false);
  const [componentLogs, setComponentLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Restart dialog
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restartReason, setRestartReason] = useState('');
  const [restartInProgress, setRestartInProgress] = useState(false);
  const [componentToRestart, setComponentToRestart] = useState<SystemComponent | null>(null);

  // Logs drawer
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
  const [logFilter, setLogFilter] = useState({
    levels: [] as string[],
    search: '',
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, componentsRes, alertsRes, actionsRes] = await Promise.all([
        http.get('/maintenance/overview'),
        http.get('/maintenance/components'),
        http.get('/maintenance/alerts'),
        http.get('/maintenance/actions?limit=20'),
      ]);
      setOverview(overviewRes);
      setComponents(componentsRes);
      setAlerts(alertsRes);
      setActions(actionsRes.items || []);
    } catch (error) {
      console.error('Failed to fetch maintenance data:', error);
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch logs
  const fetchLogs = useCallback(async (code: string) => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilter.levels.length > 0) {
        params.append('levels', logFilter.levels.join(','));
      }
      if (logFilter.search) {
        params.append('search', logFilter.search);
      }
      params.append('limit', '200');

      const res = await http.get(`/maintenance/components/${code}/logs?${params.toString()}`);
      setComponentLogs(res.entries || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setComponentLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [http, logFilter]);

  // Handle restart
  const handleRestartClick = (component: SystemComponent) => {
    setComponentToRestart(component);
    setRestartReason('');
    setRestartDialogOpen(true);
  };

  const handleRestartConfirm = async () => {
    if (!componentToRestart) return;

    setRestartInProgress(true);
    try {
      await http.post(`/maintenance/components/${componentToRestart.id}/restart`, {
        reason: restartReason || undefined,
      });
      setRestartDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Restart failed:', error);
    } finally {
      setRestartInProgress(false);
    }
  };

  // Handle health check
  const handleRunHealthCheck = async (component: SystemComponent) => {
    try {
      await http.post(`/maintenance/components/${component.id}/health/run`, {});
      fetchData();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  // Handle view logs
  const handleViewLogs = async (component: SystemComponent) => {
    setSelectedComponent(component);
    setLogsDrawerOpen(true);
    await fetchLogs(component.code);
  };

  // Handle acknowledge alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await http.patch(`/maintenance/alerts/${alertId}/acknowledge`, {});
      fetchData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  // Handle download diagnostics
  const handleDownloadDiagnostics = async () => {
    try {
      const result = await http.post('/maintenance/diagnostics', {
        componentCodes: [],
        includeLogs: true,
        includeMetrics: true,
      });
      // Download the file
      window.open(`/api/maintenance/diagnostics/${result.filename}`, '_blank');
    } catch (error) {
      console.error('Failed to generate diagnostics:', error);
    }
  };

  if (loading && !overview) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            🔧 {t('maintenance.title', 'Обслуговування системи')}
          </Typography>
          <Box>
            <Button
              startIcon={<DiagnosticsIcon />}
              onClick={handleDownloadDiagnostics}
              sx={{ mr: 1 }}
            >
              {t('maintenance.diagnostics', 'Діагностика')}
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              {t('common.refresh', 'Оновити')}
            </Button>
          </Box>
        </Box>

        {/* System Health Overview Cards */}
        <Grid container spacing={3} mb={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Card
              sx={{
                borderLeft: 4,
                borderColor:
                  overview?.overallHealth === 'HEALTHY'
                    ? 'success.main'
                    : overview?.overallHealth === 'DEGRADED'
                    ? 'warning.main'
                    : 'error.main',
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('maintenance.systemHealth', 'Стан системи')}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  {overview?.overallHealth === 'HEALTHY' && <OkIcon color="success" fontSize="large" />}
                  {overview?.overallHealth === 'DEGRADED' && <WarningIcon color="warning" fontSize="large" />}
                  {overview?.overallHealth === 'CRITICAL' && <ErrorIcon color="error" fontSize="large" />}
                  <Typography variant="h4">
                    {overview?.overallHealth === 'HEALTHY' && t('maintenance.healthy', 'Справна')}
                    {overview?.overallHealth === 'DEGRADED' && t('maintenance.degraded', 'Деградована')}
                    {overview?.overallHealth === 'CRITICAL' && t('maintenance.critical', 'Критична')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('maintenance.components', 'Компоненти')}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    icon={<OkIcon />}
                    label={`${overview?.components.OK || 0} OK`}
                    color="success"
                    size="small"
                  />
                  {(overview?.components.DEGRADED || 0) > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={`${overview?.components.DEGRADED} Деград.`}
                      color="warning"
                      size="small"
                    />
                  )}
                  {(overview?.components.DOWN || 0) > 0 && (
                    <Chip
                      icon={<ErrorIcon />}
                      label={`${overview?.components.DOWN} Down`}
                      color="error"
                      size="small"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('maintenance.activeAlerts', 'Активні сповіщення')}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {(overview?.alerts.total || 0) === 0 ? (
                    <Typography color="text.secondary">
                      {t('maintenance.noAlerts', 'Немає сповіщень')}
                    </Typography>
                  ) : (
                    <>
                      {(overview?.alerts.CRITICAL || 0) > 0 && (
                        <Chip
                          label={`${overview?.alerts.CRITICAL} Крит.`}
                          color="error"
                          size="small"
                        />
                      )}
                      {(overview?.alerts.ERROR || 0) > 0 && (
                        <Chip
                          label={`${overview?.alerts.ERROR} Помилок`}
                          color="error"
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {(overview?.alerts.WARNING || 0) > 0 && (
                        <Chip
                          label={`${overview?.alerts.WARNING} Попер.`}
                          color="warning"
                          size="small"
                        />
                      )}
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('maintenance.lastUpdated', 'Оновлено')}
                </Typography>
                <Typography variant="h6">
                  {overview?.lastUpdated ? formatDateTime(overview.lastUpdated) : '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab
              icon={<ApiIcon />}
              label={t('maintenance.tabs.components', 'Компоненти')}
              iconPosition="start"
            />
            <Tab
              icon={
                <Badge badgeContent={alerts.filter(a => !a.isAcknowledged).length} color="error">
                  <AlertIcon />
                </Badge>
              }
              label={t('maintenance.tabs.alerts', 'Сповіщення')}
              iconPosition="start"
            />
            <Tab
              icon={<HistoryIcon />}
              label={t('maintenance.tabs.history', 'Історія дій')}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Components Tab */}
        {tabValue === 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('maintenance.table.component', 'Компонент')}</TableCell>
                  <TableCell>{t('maintenance.table.status', 'Статус')}</TableCell>
                  <TableCell>{t('maintenance.table.healthChecks', 'Health Checks')}</TableCell>
                  <TableCell>{t('maintenance.table.metrics', 'Метрики')}</TableCell>
                  <TableCell>{t('maintenance.table.lastHeartbeat', 'Останній зв\'язок')}</TableCell>
                  <TableCell align="right">{t('maintenance.table.actions', 'Дії')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {components.map((component) => (
                  <TableRow key={component.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getComponentIcon(component.componentType)}
                        <Box>
                          <Typography fontWeight={500}>
                            {component.name}
                            {component.isCritical && (
                              <Chip
                                label="Critical"
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {component.code} • {component.version || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(component.status)}
                        label={component.status}
                        color={getStatusColor(component.status)}
                        size="small"
                      />
                      {component.statusReason && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {component.statusReason.substring(0, 50)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {component.healthChecks.map((check) => (
                          <Tooltip key={check.id} title={`${check.name}: ${check.lastMessage || check.lastStatus}`}>
                            <Chip
                              label={check.name.substring(0, 10)}
                              size="small"
                              color={getStatusColor(check.lastStatus)}
                              variant="outlined"
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {component.metrics ? (
                        <Box>
                          {component.metrics.cpuUsage !== undefined && (
                            <Typography variant="caption" display="block">
                              CPU: {component.metrics.cpuUsage.toFixed(1)}%
                            </Typography>
                          )}
                          {component.metrics.memoryUsagePercent !== undefined && (
                            <Typography variant="caption" display="block">
                              RAM: {component.metrics.memoryUsagePercent.toFixed(1)}%
                            </Typography>
                          )}
                          {component.metrics.uptimeSeconds !== undefined && (
                            <Typography variant="caption" display="block">
                              Uptime: {formatUptime(component.metrics.uptimeSeconds)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(component.lastHeartbeat)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('maintenance.runHealthCheck', 'Запустити Health Check')}>
                        <IconButton
                          size="small"
                          onClick={() => handleRunHealthCheck(component)}
                        >
                          <HealthIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('maintenance.viewLogs', 'Переглянути логи')}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewLogs(component)}
                        >
                          <LogsIcon />
                        </IconButton>
                      </Tooltip>
                      {component.isRestartable && (
                        <Tooltip title={t('maintenance.restart', 'Перезапустити')}>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleRestartClick(component)}
                            disabled={component.status === 'RESTARTING'}
                          >
                            <RestartIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Alerts Tab */}
        {tabValue === 1 && (
          <Box>
            {alerts.length === 0 ? (
              <Alert severity="success">
                <AlertTitle>{t('maintenance.noActiveAlerts', 'Немає активних сповіщень')}</AlertTitle>
                {t('maintenance.allSystemsNormal', 'Всі системи працюють нормально.')}
              </Alert>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    severity={
                      alert.severity === 'CRITICAL' || alert.severity === 'ERROR'
                        ? 'error'
                        : alert.severity === 'WARNING'
                        ? 'warning'
                        : 'info'
                    }
                    action={
                      !alert.isAcknowledged && (
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          {t('maintenance.acknowledge', 'Підтвердити')}
                        </Button>
                      )
                    }
                  >
                    <AlertTitle>
                      {alert.title}
                      {alert.isAcknowledged && (
                        <Chip
                          label={t('maintenance.acknowledged', 'Підтверджено')}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </AlertTitle>
                    <Typography variant="body2">{alert.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alert.component?.name} • {formatDateTime(alert.triggeredAt)}
                    </Typography>
                  </Alert>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* History Tab */}
        {tabValue === 2 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('maintenance.history.when', 'Коли')}</TableCell>
                  <TableCell>{t('maintenance.history.component', 'Компонент')}</TableCell>
                  <TableCell>{t('maintenance.history.action', 'Дія')}</TableCell>
                  <TableCell>{t('maintenance.history.actor', 'Виконавець')}</TableCell>
                  <TableCell>{t('maintenance.history.reason', 'Причина')}</TableCell>
                  <TableCell>{t('maintenance.history.status', 'Статус')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{formatDateTime(action.requestedAt)}</TableCell>
                    <TableCell>{action.component?.name || '-'}</TableCell>
                    <TableCell>
                      <Chip label={action.actionType} size="small" />
                    </TableCell>
                    <TableCell>{action.actorName || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {action.reason || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={action.status}
                        size="small"
                        color={
                          action.status === 'COMPLETED'
                            ? 'success'
                            : action.status === 'FAILED'
                            ? 'error'
                            : action.status === 'IN_PROGRESS'
                            ? 'info'
                            : 'default'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {actions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        {t('maintenance.noActions', 'Немає записів історії')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Restart Confirmation Dialog */}
        <Dialog open={restartDialogOpen} onClose={() => setRestartDialogOpen(false)}>
          <DialogTitle>
            {t('maintenance.restartDialog.title', 'Підтвердження перезапуску')}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('maintenance.restartDialog.message', 'Ви впевнені, що хочете перезапустити компонент')}
              <strong> {componentToRestart?.name}</strong>?
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label={t('maintenance.restartDialog.reason', 'Причина (необов\'язково)')}
              fullWidth
              variant="outlined"
              value={restartReason}
              onChange={(e) => setRestartReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRestartDialogOpen(false)}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button
              onClick={handleRestartConfirm}
              color="warning"
              variant="contained"
              disabled={restartInProgress}
              startIcon={restartInProgress ? <CircularProgress size={16} /> : <RestartIcon />}
            >
              {t('maintenance.restart', 'Перезапустити')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Logs Drawer */}
        <Drawer
          anchor="right"
          open={logsDrawerOpen}
          onClose={() => setLogsDrawerOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', md: 600 } } }}
        >
          <Box sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                {t('maintenance.logs.title', 'Логи')}: {selectedComponent?.name}
              </Typography>
              <IconButton onClick={() => setLogsDrawerOpen(false)}>
                ✕
              </IconButton>
            </Box>

            {/* Log Filters */}
            <Box display="flex" gap={2} mb={2}>
              <TextField
                size="small"
                placeholder={t('maintenance.logs.search', 'Пошук...')}
                value={logFilter.search}
                onChange={(e) => setLogFilter({ ...logFilter, search: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t('maintenance.logs.level', 'Рівень')}</InputLabel>
                <Select
                  multiple
                  value={logFilter.levels}
                  onChange={(e) =>
                    setLogFilter({ ...logFilter, levels: e.target.value as string[] })
                  }
                  label={t('maintenance.logs.level', 'Рівень')}
                >
                  {['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].map((level) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                onClick={() => selectedComponent && fetchLogs(selectedComponent.code)}
              >
                <RefreshIcon />
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Log Entries */}
            {logsLoading ? (
              <LinearProgress />
            ) : (
              <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                {componentLogs.map((entry) => (
                  <ListItem
                    key={entry.id}
                    sx={{
                      borderLeft: 3,
                      borderColor:
                        entry.level === 'ERROR' || entry.level === 'FATAL'
                          ? 'error.main'
                          : entry.level === 'WARN'
                          ? 'warning.main'
                          : 'grey.300',
                      mb: 0.5,
                      bgcolor: 'grey.50',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" gap={1} alignItems="center">
                          <Chip
                            label={entry.level}
                            size="small"
                            color={getLogLevelColor(entry.level)}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(entry.timestamp)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            m: 0,
                            mt: 0.5,
                          }}
                        >
                          {entry.message}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
                {componentLogs.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary={t('maintenance.logs.noLogs', 'Немає логів для відображення')}
                    />
                  </ListItem>
                )}
              </List>
            )}
          </Box>
        </Drawer>
      </Box>
    </Container>
  );
}
