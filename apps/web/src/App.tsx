import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import CiscoLayout from '@/components/CiscoLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Search from '@/pages/Search'
import Recording from '@/pages/Recording'
import Evaluations from '@/pages/Evaluations'
import Coaching from '@/pages/Coaching'
import AdminSettings from '@/pages/AdminSettings'
import Maintenance from '@/pages/Maintenance'
import { ThemeContextProvider, useThemeMode } from '@/contexts/ThemeContext'

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

function LayoutSwitcher() {
  const { themeMode } = useThemeMode()
  return themeMode === 'cisco' ? <CiscoLayout /> : <Layout />
}

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><LayoutSwitcher /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="search" element={<Search />} />
          <Route path="recordings/:id" element={<Recording />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="coaching" element={<Coaching />} />
          <Route path="admin/settings" element={<AdminSettings />} />
          <Route path="admin/maintenance" element={<Maintenance />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default function App() {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      <AppContent />
    </ThemeContextProvider>
  )
}
