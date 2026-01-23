import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Typography,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

interface MediaSenseConfig {
  apiUrl: string
  apiKey: string
  apiSecret: string
  enabled: boolean
  allowSelfSigned?: boolean
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: Record<string, any>
  requestId?: string
}

interface TestResult {
  success: boolean
  message: string
  details?: {
    step: string
    status: 'ok' | 'error'
    message?: string
    duration?: number
  }[]
  recommendations?: string[]
}

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'

export default function MediaSenseSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Config state
  const [config, setConfig] = useState<MediaSenseConfig>({
    apiUrl: '',
    apiKey: '',
    apiSecret: '',
    enabled: false,
    allowSelfSigned: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Test connection state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logLevel, setLogLevel] = useState<LogLevel>('INFO')
  const [logsLoading, setLogsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [hasMoreLogs, setHasMoreLogs] = useState(false)
  const [logCursor, setLogCursor] = useState<string | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/mediasense')
        if (response.data?.settings) {
          setConfig({
            apiUrl: response.data.settings.apiUrl || '',
            apiKey: response.data.settings.apiKey || '',
            apiSecret: response.data.settings.apiSecret || '',
            enabled: response.data.enabled || false,
            allowSelfSigned: response.data.settings.allowSelfSigned || false,
          })
        }
      } catch (error) {
        console.error('Failed to load MediaSense settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  // Load logs
  const loadLogs = useCallback(async (append = false) => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams({
        level: logLevel,
        limit: '100',
      })
      if (append && logCursor) {
        params.set('cursor', logCursor)
      }

      const response = await client.get(`/integrations/mediasense/logs?${params}`)
      const data = response.data

      if (append) {
        setLogs((prev) => [...prev, ...data.lines])
      } else {
        setLogs(data.lines || [])
      }
      setHasMoreLogs(data.hasMore)
      setLogCursor(data.nextCursor)
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [client, logLevel, logCursor])

  // Initial logs load
  useEffect(() => {
    if (!loading) {
      loadLogs()
    }
  }, [loading, logLevel])

  // Auto-refresh logs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(() => loadLogs(), 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, loadLogs])

  const handleChange = (field: keyof MediaSenseConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await client.put('/integrations/mediasense', config)
      setMessage({ type: 'success', text: t('admin.settingsSaved') })
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      setMessage({ type: 'error', text: t('admin.settingsFailed') })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await client.post('/integrations/mediasense/test', {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        allowSelfSigned: config.allowSelfSigned,
      })
      setTestResult(response.data)
      // Refresh logs after test
      setTimeout(() => loadLogs(), 500)
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || t('mediaSense.testFailed'),
        recommendations: [t('mediaSense.checkConnection')],
      })
    } finally {
      setTesting(false)
    }
  }

  const handleClearLogs = async () => {
    setClearDialogOpen(false)
    try {
      await client.post('/integrations/mediasense/logs/clear')
      setLogs([])
      setLogCursor(null)
      setHasMoreLogs(false)
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const handleLogLevelChange = async (newLevel: LogLevel) => {
    setLogLevel(newLevel)
    setLogCursor(null)
    // Also update runtime level on server
    try {
      await client.put('/integrations/mediasense/logs/level', { level: newLevel })
    } catch (error) {
      console.error('Failed to update log level:', error)
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return '#f44336'
      case 'WARN':
        return '#ff9800'
      case 'INFO':
        return '#2196f3'
      case 'DEBUG':
        return '#9e9e9e'
      default:
        return '#333'
    }
  }

  const formatLogTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('admin.mediaSenseDescription')}
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {/* Configuration Form */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('admin.mediaSenseUrl')}
            value={config.apiUrl}
            onChange={(e) => handleChange('apiUrl', e.target.value)}
            placeholder="https://mediasense.example.com:8440"
            disabled={saving}
            helperText={t('mediaSense.urlHelp', 'Default port: 8440')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.mediaSenseApiKey')}
            value={config.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            type="password"
            disabled={saving}
            helperText={t('mediaSense.apiKeyHelp', 'Username for MediaSense API')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.mediaSenseApiSecret')}
            value={config.apiSecret}
            onChange={(e) => handleChange('apiSecret', e.target.value)}
            type="password"
            disabled={saving}
            helperText={t('mediaSense.apiSecretHelp', 'Password for MediaSense API')}
          />
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.allowSelfSigned || false}
                onChange={(e) => handleChange('allowSelfSigned', e.target.checked)}
                disabled={saving}
              />
            }
            label={t('mediaSense.allowSelfSigned', 'Allow self-signed certificates (testing only)')}
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? <CircularProgress size={24} /> : t('admin.save')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setConfig({
              apiUrl: '',
              apiKey: '',
              apiSecret: '',
              enabled: false,
              allowSelfSigned: false,
            })
          }}
          disabled={saving}
        >
          {t('admin.reset')}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleTestConnection}
          disabled={testing || !config.apiUrl || !config.apiKey || !config.apiSecret}
          startIcon={testing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
        >
          {t('mediaSense.testConnection', 'Test Connection')}
        </Button>
      </Box>

      {/* Test Result */}
      {testResult && (
        <Paper sx={{ mt: 3, p: 2, bgcolor: testResult.success ? '#e8f5e9' : '#ffebee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {testResult.success ? (
              <CheckCircleIcon color="success" />
            ) : (
              <ErrorIcon color="error" />
            )}
            <Typography variant="subtitle1" fontWeight="bold">
              {testResult.message}
            </Typography>
          </Box>

          {testResult.details && testResult.details.length > 0 && (
            <Box sx={{ ml: 4, mb: 2 }}>
              {testResult.details.map((detail, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5 }}>
                  {detail.status === 'ok' ? (
                    <CheckCircleIcon fontSize="small" color="success" />
                  ) : (
                    <ErrorIcon fontSize="small" color="error" />
                  )}
                  <Typography variant="body2">
                    <strong>{detail.step}:</strong> {detail.message}
                    {detail.duration && ` (${detail.duration}ms)`}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {testResult.recommendations && testResult.recommendations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                <WarningIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                {t('mediaSense.recommendations', 'Recommendations:')}
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {testResult.recommendations.map((rec, idx) => (
                  <li key={idx}>
                    <Typography variant="body2" color="textSecondary">
                      {rec}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Paper>
      )}

      {/* Logs Section */}
      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('mediaSense.logsTitle', 'MediaSense Integration Logs')}
      </Typography>

      {/* Log Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{t('mediaSense.logLevel', 'Log Level')}</InputLabel>
          <Select
            value={logLevel}
            label={t('mediaSense.logLevel', 'Log Level')}
            onChange={(e) => handleLogLevelChange(e.target.value as LogLevel)}
          >
            <MenuItem value="ERROR">ERROR / CRITICAL</MenuItem>
            <MenuItem value="WARN">WARN</MenuItem>
            <MenuItem value="INFO">INFO</MenuItem>
            <MenuItem value="DEBUG">DEBUG</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              size="small"
            />
          }
          label={t('mediaSense.autoRefresh', 'Auto-refresh')}
        />

        <Tooltip title={t('mediaSense.refreshLogs', 'Refresh logs')}>
          <IconButton onClick={() => loadLogs()} disabled={logsLoading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('mediaSense.clearLogs', 'Clear logs')}>
          <IconButton onClick={() => setClearDialogOpen(true)} color="error">
            <DeleteIcon />
          </IconButton>
        </Tooltip>

        <Chip
          label={`${logs.length} ${t('mediaSense.entries', 'entries')}`}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Log Viewer */}
      <Paper
        ref={logContainerRef}
        sx={{
          p: 2,
          bgcolor: '#1e1e1e',
          maxHeight: 400,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        {logsLoading && logs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#fff' }} />
          </Box>
        ) : logs.length === 0 ? (
          <Typography sx={{ color: '#888', textAlign: 'center', py: 4 }}>
            {t('mediaSense.noLogs', 'No logs available')}
          </Typography>
        ) : (
          <>
            {logs.map((log, idx) => (
              <Box
                key={`${log.timestamp}-${idx}`}
                sx={{
                  py: 0.5,
                  borderBottom: '1px solid #333',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Typography
                    component="span"
                    sx={{ color: '#888', fontSize: '11px', minWidth: 150 }}
                  >
                    {formatLogTimestamp(log.timestamp)}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: getLogLevelColor(log.level),
                      fontWeight: 'bold',
                      minWidth: 50,
                    }}
                  >
                    [{log.level}]
                  </Typography>
                  {log.requestId && (
                    <Typography component="span" sx={{ color: '#666', fontSize: '11px' }}>
                      [{log.requestId}]
                    </Typography>
                  )}
                  <Typography component="span" sx={{ color: '#e0e0e0', flex: 1 }}>
                    {log.message}
                  </Typography>
                </Box>
                {log.context && Object.keys(log.context).length > 0 && (
                  <Typography
                    sx={{
                      color: '#888',
                      fontSize: '11px',
                      ml: 2,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {JSON.stringify(log.context, null, 2)}
                  </Typography>
                )}
              </Box>
            ))}

            {hasMoreLogs && (
              <Box sx={{ textAlign: 'center', pt: 2 }}>
                <Button
                  size="small"
                  onClick={() => loadLogs(true)}
                  disabled={logsLoading}
                  sx={{ color: '#888' }}
                >
                  {logsLoading ? (
                    <CircularProgress size={16} sx={{ color: '#888' }} />
                  ) : (
                    t('mediaSense.loadMore', 'Load More')
                  )}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Clear Logs Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>{t('mediaSense.clearLogsConfirmTitle', 'Clear Logs?')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              'mediaSense.clearLogsConfirmText',
              'Are you sure you want to clear all MediaSense integration logs? This action cannot be undone.',
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleClearLogs} color="error" variant="contained">
            {t('mediaSense.clearLogs', 'Clear Logs')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
