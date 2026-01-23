import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import { useThemeMode } from '@/contexts/ThemeContext'
import PaletteIcon from '@mui/icons-material/Palette'

export default function ThemeSwitcher() {
  const { themeMode, setThemeMode } = useThemeMode()

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="Switch UI Theme">
        <PaletteIcon sx={{ fontSize: 20, opacity: 0.8 }} />
      </Tooltip>
      <ToggleButtonGroup
        value={themeMode}
        exclusive
        onChange={(_, value) => value && setThemeMode(value)}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            padding: '4px 12px',
            fontSize: '0.75rem',
            textTransform: 'none',
            color: 'inherit',
            borderColor: 'rgba(255,255,255,0.3)',
            '&.Mui-selected': {
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)',
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          },
        }}
      >
        <ToggleButton value="default">
          <Typography variant="caption" sx={{ fontWeight: themeMode === 'default' ? 600 : 400 }}>
            QMS
          </Typography>
        </ToggleButton>
        <ToggleButton value="cisco">
          <Typography variant="caption" sx={{ fontWeight: themeMode === 'cisco' ? 600 : 400 }}>
            CUIC
          </Typography>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
