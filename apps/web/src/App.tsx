import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Search from '@/pages/Search'
import Recording from '@/pages/Recording'
import Evaluations from '@/pages/Evaluations'
import Coaching from '@/pages/Coaching'
import AdminSettings from '@/pages/AdminSettings'

const theme = createTheme({
  palette: {
    primary: {
      main: '#FF8C00', // Cisco orange
    },
    secondary: {
      main: '#444444', // Dark gray
    },
    background: {
      default: '#F5F5F5', // Light gray
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('jwt_token')
    if (!token) {
      setIsAuthenticated(false)
    }
    setLoading(false)
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="recordings/:id" element={<Recording />} />
            <Route path="evaluations" element={<Evaluations />} />
            <Route path="coaching" element={<Coaching />} />
            <Route path="admin/settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
