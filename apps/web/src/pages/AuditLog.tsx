import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Button,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'
import RefreshIcon from '@mui/icons-material/Refresh'
import SecurityIcon from '@mui/icons-material/Security'

interface AuditEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  action: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

interface AuditResponse {
  items: AuditEntry[]
  total: number
  page: number
  pageSize: number
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'audit.actionLogin',
  SEARCH: 'audit.actionSearch',
  RECORD_VIEW: 'audit.actionRecordView',
  PLAYBACK_START: 'audit.actionPlaybackStart',
  PLAYBACK_PAUSE: 'audit.actionPlaybackPause',
  PLAYBACK_SEEK: 'audit.actionPlaybackSeek',
  PLAYBACK_COMPLETE: 'audit.actionPlaybackComplete',
  RECORD_DOWNLOAD: 'audit.actionRecordDownload',
  EVALUATION_CREATED: 'audit.actionEvaluationCreated',
  COACHING_CREATED: 'audit.actionCoachingCreated',
  EVALUATION_SUBMITTED: 'audit.actionEvaluationSubmitted',
  DISPUTE_FILED: 'audit.actionDisputeFiled',
  AUDIT_VIEW: 'audit.actionAuditView',
}

export default function AuditLog() {
  const { t } = useTranslation()
  const http = useHttpClient()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    action: '',
    userId: '',
    page: 1,
    pageSize: 50,
  })

  const fetchAudit = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {
        page: filters.page,
        pageSize: filters.pageSize,
      }
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      if (filters.action) params.action = filters.action
      if (filters.userId) params.userId = filters.userId

      const res = await http.get<AuditResponse>('/audit', { params })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || t('audit.loadError', 'Failed to load audit log'))
    } finally {
      setLoading(false)
    }
  }, [http, filters, t])

  useEffect(() => {
    const token = localStorage.getItem('jwt_token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const role = payload.roles?.[0] || 'USER'
        if (role !== 'ADMIN') {
          setUserRole(null)
          return
        }
        setUserRole(role)
        fetchAudit()
      } catch {
        setUserRole(null)
      }
    } else {
      setUserRole(null)
    }
  }, [fetchAudit])

  const handlePageChange = (_: unknown, newPage: number) => {
    setFilters((f) => ({ ...f, page: newPage + 1 }))
  }

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((f) => ({ ...f, pageSize: parseInt(e.target.value, 10), page: 1 }))
  }

  useEffect(() => {
    if (userRole === 'ADMIN') fetchAudit()
  }, [filters, userRole, fetchAudit])

  if (userRole !== 'ADMIN') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('admin.accessDenied')}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <SecurityIcon sx={{ fontSize: 32, color: '#049FD9' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('audit.title', 'Аудиторський слід')}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {t('audit.subtitle', 'Журнал подій (тільки перегляд, зміни не дозволені)')}
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label={t('audit.dateFrom', 'Дата з')}
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label={t('audit.dateTo', 'Дата до')}
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('audit.action', 'Дія')}</InputLabel>
            <Select
              value={filters.action}
              label={t('audit.action', 'Дія')}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value, page: 1 }))}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {Object.keys(ACTION_LABELS).map((a) => (
                <MenuItem key={a} value={a}>
                  {t(ACTION_LABELS[a], a)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchAudit()}
            disabled={loading}
          >
            {t('common.refresh')}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('audit.timestamp', 'Час')}</TableCell>
                    <TableCell>{t('audit.user', 'Користувач')}</TableCell>
                    <TableCell>{t('audit.role', 'Роль')}</TableCell>
                    <TableCell>{t('audit.action', 'Дія')}</TableCell>
                    <TableCell>{t('audit.resource', 'Ресурс')}</TableCell>
                    <TableCell>{t('audit.ip', 'IP')}</TableCell>
                    <TableCell>{t('audit.metadata', 'Метадані')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.items?.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>
                        <Chip label={row.userRole} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{t(ACTION_LABELS[row.action] || row.action, row.action)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {row.resourceId || '—'}
                      </TableCell>
                      <TableCell>{row.ipAddress || '—'}</TableCell>
                      <TableCell>
                        {row.metadata && Object.keys(row.metadata).length > 0 ? (
                          <Typography variant="caption" component="pre" sx={{ overflow: 'auto', maxWidth: 200 }}>
                            {JSON.stringify(row.metadata)}
                          </Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {data && (
              <TablePagination
                component="div"
                count={data.total}
                page={data.page - 1}
                onPageChange={handlePageChange}
                rowsPerPage={data.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[25, 50, 100]}
                labelRowsPerPage={t('common.rowsPerPage')}
              />
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
