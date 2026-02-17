import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useInactivityTimeout } from '@/hooks/useHttpClient'
import Layout from '@/components/Layout'
import CiscoLayout from '@/components/CiscoLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Search from '@/pages/Search'
import Recording from '@/pages/Recording'
import Evaluations from '@/pages/Evaluations'
import EvaluationDetail from '@/pages/EvaluationDetail'
import Scorecards from '@/pages/Scorecards'
import ScorecardEdit from '@/pages/ScorecardEdit'
import Coaching from '@/pages/Coaching'
import AdminSettings from '@/pages/AdminSettings'
import Maintenance from '@/pages/Maintenance'
import About from '@/pages/About'
import AuditLog from '@/pages/AuditLog'
import { ThemeContextProvider, useThemeMode } from '@/contexts/ThemeContext'

function SessionTimeoutHandler({ children }: { children: React.ReactNode }) {
  useInactivityTimeout()
  return <>{children}</>
}

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

  return isAuthenticated ? (
    <SessionTimeoutHandler>{children}</SessionTimeoutHandler>
  ) : (
    <Navigate to="/login" replace />
  )
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
          <Route path="evaluations/:id" element={<EvaluationDetail />} />
          <Route path="scorecards" element={<Scorecards />} />
          <Route path="scorecards/:id/edit" element={<ScorecardEdit />} />
          <Route path="scorecards/new" element={<ScorecardEdit />} />
          <Route path="coaching" element={<Coaching />} />
          <Route path="admin/settings" element={<AdminSettings />} />
          <Route path="admin/maintenance" element={<Maintenance />} />
          <Route path="admin/audit" element={<AuditLog />} />
          <Route path="about" element={<About />} />
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
