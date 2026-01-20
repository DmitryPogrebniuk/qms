import { Box, Button } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
      <Button
        color="inherit"
        size="small"
        onClick={() => i18n.changeLanguage('uk')}
        sx={{
          fontWeight: i18n.language === 'uk' ? 'bold' : 'normal',
          borderBottom: i18n.language === 'uk' ? '2px solid white' : 'none',
        }}
      >
        УК
      </Button>
      <Button
        color="inherit"
        size="small"
        onClick={() => i18n.changeLanguage('en')}
        sx={{
          fontWeight: i18n.language === 'en' ? 'bold' : 'normal',
          borderBottom: i18n.language === 'en' ? '2px solid white' : 'none',
        }}
      >
        EN
      </Button>
    </Box>
  )
}
