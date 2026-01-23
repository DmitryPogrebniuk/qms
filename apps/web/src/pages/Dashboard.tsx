import { Typography, Paper, Grid, Box, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/contexts/ThemeContext'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

export default function Dashboard() {
  const { t } = useTranslation()
  const { themeMode } = useThemeMode()

  // CUIC-style Dashboard
  if (themeMode === 'cisco') {
    return (
      <Box>
        {/* CUIC Header Section */}
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 300, 
              color: '#333333',
              fontStyle: 'italic',
              mb: 2
            }}
          >
            Cisco Unified Intelligence Center
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#666666',
              mb: 1
            }}
          >
            {t('ciscoNav.reportDashboards', 'Expand the boundaries of traditional call center reporting capabilities')}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ color: '#999999' }}
          >
            Version 15.0(1) Build 15.0.1.10000.27
          </Typography>
        </Box>

        {/* Interactive Help Button - CUIC style */}
        <Box sx={{ 
          position: 'fixed', 
          bottom: 80, 
          left: '50%', 
          transform: 'translateX(-50%)'
        }}>
          <Button
            variant="contained"
            startIcon={<HelpOutlineIcon />}
            sx={{
              backgroundColor: '#049FD9',
              color: '#FFFFFF',
              textTransform: 'none',
              px: 3,
              py: 1,
              '&:hover': {
                backgroundColor: '#007A99',
              },
            }}
          >
            {t('ciscoNav.interactiveHelp', 'Interactive Help')}
          </Button>
        </Box>

        {/* Quick Stats Cards */}
        <Grid container spacing={3} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              textAlign: 'center',
              border: '1px solid #E0E0E0',
              boxShadow: 'none',
            }}>
              <Typography variant="h2" sx={{ color: '#049FD9', fontWeight: 300 }}>
                0
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('dashboard.pendingEvaluations')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              textAlign: 'center',
              border: '1px solid #E0E0E0',
              boxShadow: 'none',
            }}>
              <Typography variant="h2" sx={{ color: '#4CAF50', fontWeight: 300 }}>
                0
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('dashboard.recentEvaluations')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              textAlign: 'center',
              border: '1px solid #E0E0E0',
              boxShadow: 'none',
            }}>
              <Typography variant="h2" sx={{ color: '#FF9800', fontWeight: 300 }}>
                0
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('coaching.plans', 'Coaching Plans')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    )
  }

  // Default QMS Dashboard
  return (
    <Box>
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
    </Box>
  )
}
