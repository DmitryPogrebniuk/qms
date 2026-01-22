import { test, expect } from '@playwright/test'

test.describe('Admin Settings - User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.getByLabel(/username|користувач/i).fill('boss')
    await page.getByLabel(/password|пароль/i).fill('boss')
    await page.getByRole('button', { name: /login|вхід/i }).click()
    await page.waitForTimeout(2000)
    
    // Navigate to admin settings
    await page.getByRole('button').first().click()
    await page.getByText(/integration settings|налаштування інтеграції/i).click()
    await page.waitForURL(/.*admin\/settings/)
  })

  test('should display admin settings page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /integration settings|параметри інтеграції/i })).toBeVisible()
  })

  test('should have users tab', async ({ page }) => {
    // Look for Users tab
    const usersTab = page.getByRole('tab', { name: /users|користувачі/i })
    await expect(usersTab).toBeVisible()
  })

  test('should display users management section', async ({ page }) => {
    // Click on users tab if it exists
    const usersTab = page.getByRole('tab', { name: /users|користувачі/i })
    if (await usersTab.isVisible()) {
      await usersTab.click()
      
      // Wait for users list or table
      await page.waitForTimeout(1000)
      
      // Check for common user management elements
      const hasAddButton = await page.getByRole('button', { name: /add|додати/i }).isVisible().catch(() => false)
      const hasTable = await page.getByRole('table').isVisible().catch(() => false)
      
      expect(hasAddButton || hasTable).toBeTruthy()
    }
  })

  test('should have multiple settings tabs', async ({ page }) => {
    // Check for various settings tabs
    const tabs = page.getByRole('tablist')
    await expect(tabs).toBeVisible()
    
    // Should have multiple tabs
    const tabButtons = await tabs.getByRole('tab').all()
    expect(tabButtons.length).toBeGreaterThan(1)
  })

  test.skip('should not allow non-admin access', async ({ page }) => {
    // Skipped: agent001 user doesn't exist in test environment
    // Logout
    await page.getByRole('button', { name: /logout|вихід/i }).click()
    await page.waitForURL(/.*login/)
    
    // Login as regular user (if exists)
    await page.getByLabel(/username|користувач/i).fill('agent001')
    await page.getByLabel(/password|пароль/i).fill('password123')
    await page.getByRole('button', { name: /login|вхід/i }).click()
    
    // Try to access admin settings directly
    await page.goto('/admin/settings')
    
    // Should show access denied or redirect
    await page.waitForTimeout(1000)
    const hasAccessDenied = await page.getByText(/access denied|доступ заборонено/i).isVisible().catch(() => false)
    const isOnDashboard = page.url().includes('dashboard') || page.url().endsWith('/')
    
    expect(hasAccessDenied || isOnDashboard).toBeTruthy()
  })
})
