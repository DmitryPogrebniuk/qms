import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.getByLabel(/користувач/i).fill('boss')
    await page.getByLabel(/пароль/i).fill('boss')
    await page.getByRole('button', { name: /вхід/i }).click()
    await page.waitForURL(/.*dashboard/)
  })

  test('should display menu button', async ({ page }) => {
    const menuButton = page.getByRole('button').first()
    await expect(menuButton).toBeVisible()
  })

  test('should open navigation drawer', async ({ page }) => {
    // Click menu button
    await page.getByRole('button').first().click()
    
    // Check drawer items are visible
    await expect(page.getByText(/nav\.dashboard/i)).toBeVisible()
    await expect(page.getByText(/nav\.search/i)).toBeVisible()
    await expect(page.getByText(/nav\.evaluations/i)).toBeVisible()
    await expect(page.getByText(/nav\.coaching/i)).toBeVisible()
  })

  test('should show admin settings for admin user', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Admin settings should be visible for boss user
    await expect(page.getByText(/nav\.adminSettings/i)).toBeVisible()
  })

  test('should navigate to search page', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Click search
    await page.getByText(/nav\.search/i).click()
    
    // Check URL changed
    await expect(page).toHaveURL(/.*search/)
  })

  test('should navigate to admin settings', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Click admin settings
    await page.getByText(/nav\.adminSettings/i).click()
    
    // Check URL changed
    await expect(page).toHaveURL(/.*admin\/settings/)
  })

  test('should logout successfully', async ({ page }) => {
    // Click logout button in app bar
    await page.getByRole('button', { name: /logout|вихід/i }).click()
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/)
    await expect(page.getByLabel(/користувач/i)).toBeVisible()
  })
})
