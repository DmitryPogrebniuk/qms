import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dashboard from '../../pages/Dashboard'

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}))

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard heading', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    expect(screen.getByText('dashboard.welcome')).toBeInTheDocument()
  })

  it('renders recent evaluations section', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    expect(screen.getByText('dashboard.recentEvaluations')).toBeInTheDocument()
  })

  it('renders pending evaluations section', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    expect(screen.getByText('dashboard.pendingEvaluations')).toBeInTheDocument()
  })

  it('shows no data message when empty', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    const noDataMessages = screen.getAllByText('common.noData')
    expect(noDataMessages).toHaveLength(2)
  })
})
