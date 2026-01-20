import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Typography,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'

interface OpenSearchConfig {
  host: string
  port: number
  username: string
  password: string
  indexPrefix: string
  enabled: boolean
  tls: boolean
}

export default function OpenSearchSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [config, setConfig] = useState<OpenSearchConfig>({
    host: 'localhost',
    port: 9200,
    username: '',
    password: '',
    indexPrefix: 'qms',
    enabled: true,
    tls: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/opensearch')
        setConfig(response.data)
      } catch (error) {
        console.error('Failed to load OpenSearch settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  const handleChange = (field: keyof OpenSearchConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: field === 'port' ? parseInt(value) : value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await client.put('/integrations/opensearch', config)
      setMessage({ type: 'success', text: t('admin.settingsSaved') })
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      setMessage({ type: 'error', text: t('admin.settingsFailed') })
    } finally {
      setSaving(false)
    }
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
        {t('admin.openSearchDescription')}
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.openSearchHost')}
            value={config.host}
            onChange={(e) => handleChange('host', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.openSearchPort')}
            type="number"
            value={config.port}
            onChange={(e) => handleChange('port', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.openSearchUsername')}
            value={config.username}
            onChange={(e) => handleChange('username', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.openSearchPassword')}
            type="password"
            value={config.password}
            onChange={(e) => handleChange('password', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.openSearchIndexPrefix')}
            value={config.indexPrefix}
            onChange={(e) => handleChange('indexPrefix', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={config.tls}
                onChange={(e) => handleChange('tls', e.target.checked)}
                disabled={saving}
              />
            }
            label={t('admin.enableTls')}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
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
              host: 'localhost',
              port: 9200,
              username: '',
              password: '',
              indexPrefix: 'qms',
              enabled: true,
              tls: false,
            })
          }}
          disabled={saving}
        >
          {t('admin.reset')}
        </Button>
      </Box>
    </Box>
  )
}
