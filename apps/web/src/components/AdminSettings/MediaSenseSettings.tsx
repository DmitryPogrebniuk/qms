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

interface MediaSenseConfig {
  apiUrl: string
  apiKey: string
  apiSecret: string
  enabled: boolean
}

export default function MediaSenseSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [config, setConfig] = useState<MediaSenseConfig>({
    apiUrl: '',
    apiKey: '',
    apiSecret: '',
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/mediasense')
        setConfig(response.data)
      } catch (error) {
        console.error('Failed to load MediaSense settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  const handleChange = (field: keyof MediaSenseConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
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

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('admin.mediaSenseUrl')}
            value={config.apiUrl}
            onChange={(e) => handleChange('apiUrl', e.target.value)}
            placeholder="https://mediasense.example.com"
            disabled={saving}
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
              apiUrl: '',
              apiKey: '',
              apiSecret: '',
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
