import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles'

type ThemeMode = 'default' | 'cisco'

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Default QMS Theme (Orange)
const defaultTheme = createTheme({
  palette: {
    primary: {
      main: '#FF8C00', // Cisco orange
    },
    secondary: {
      main: '#444444',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
})

// Cisco CUIC Theme (Blue/Dark Sidebar)
const ciscoTheme = createTheme({
  palette: {
    primary: {
      main: '#049FD9', // Cisco blue
      dark: '#007A99',
      light: '#4FC3F7',
    },
    secondary: {
      main: '#6E6E6E',
      dark: '#424242',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#6E6E6E',
    },
    success: {
      main: '#4CAF50',
    },
  },
  typography: {
    fontFamily: '"CiscoSans", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 300,
      color: '#333333',
    },
    h5: {
      fontWeight: 400,
      color: '#333333',
    },
    h6: {
      fontWeight: 500,
      color: '#333333',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          textTransform: 'none',
          borderRadius: 4,
        },
        outlined: {
          textTransform: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#F5F5F5',
        },
      },
    },
  },
})

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('qms_theme_mode')
    return (saved as ThemeMode) || 'default'
  })

  useEffect(() => {
    localStorage.setItem('qms_theme_mode', themeMode)
  }, [themeMode])

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'default' ? 'cisco' : 'default')
  }

  const theme: Theme = themeMode === 'cisco' ? ciscoTheme : defaultTheme

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContextProvider')
  }
  return context
}
