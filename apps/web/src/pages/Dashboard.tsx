import { Container, Typography, Paper, Grid } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        {t('dashboard.welcome')}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">{t('dashboard.recentEvaluations')}</Typography>
            <Typography color="textSecondary">{t('common.noData')}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6">{t('dashboard.pendingEvaluations')}</Typography>
            <Typography color="textSecondary">{t('common.noData')}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}
