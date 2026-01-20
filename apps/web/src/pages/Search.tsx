import { Container, Typography, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function Search() {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('search.title')}
      </Typography>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
        <Typography>{t('common.noData')}</Typography>
      </Box>
    </Container>
  )
}
