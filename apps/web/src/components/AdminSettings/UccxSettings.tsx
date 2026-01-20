import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Typography,
  Divider,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'

interface UccxConfig {
  host: string
  port: number
  username: string
  password: string
  enabled: boolean
}

export default function UccxSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [config, setConfig] = useState<UccxConfig>({
    host: '',
    port: 8080,
    username: '',
    password: '',
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/uccx')
        setConfig(response.data)
      } catch (error) {
        console.error('Failed to load UCCX settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  const handleChange = (field: keyof UccxConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: field === 'port' ? parseInt(value) : value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await client.put('/integrations/uccx', config)
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
        {t('admin.uccxDescription')}
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.uccxHost')}
            value={config.host}
            onChange={(e) => handleChange('host', e.target.value)}
            placeholder="uccx.example.com"
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.uccxPort')}
            type="number"
            value={config.port}
            onChange={(e) => handleChange('port', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.uccxUsername')}
            value={config.username}
            onChange={(e) => handleChange('username', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.uccxPassword')}
            type="password"
            value={config.password}
            onChange={(e) => handleChange('password', e.target.value)}
            disabled={saving}
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
              host: '',
              port: 8080,
              username: '',
              password: '',
              enabled: false,
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
