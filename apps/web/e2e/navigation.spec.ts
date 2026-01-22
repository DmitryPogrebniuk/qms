import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.getByLabel(/username|користувач/i).fill('boss')
    await page.getByLabel(/password|пароль/i).fill('boss')
    await page.getByRole('button', { name: /login|вхід/i }).click()
    await page.waitForTimeout(2000)
  })

  test('should display menu button', async ({ page }) => {
    const menuButton = page.getByRole('button').first()
    await expect(menuButton).toBeVisible()
  })

  test('should open navigation drawer', async ({ page }) => {
    // Click menu button
    await page.getByRole('button').first().click()
    
    // Check drawer items are visible (English or Ukrainian) - use role for specificity
    await expect(page.getByText(/dashboard|панель/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^search$|пошук/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^evaluations$|оцінки/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^coaching$|коучинг/i })).toBeVisible()
  })

  test('should show admin settings for admin user', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Admin settings should be visible for boss user
    await expect(page.getByText(/integration settings|налаштування інтеграції/i)).toBeVisible()
  })

  test('should navigate to search page', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Click search
    await page.getByText(/^search$|пошук/i).click()
    
    // Check URL changed
    await expect(page).toHaveURL(/.*search/)
  })

  test('should navigate to admin settings', async ({ page }) => {
    // Open menu
    await page.getByRole('button').first().click()
    
    // Click admin settings
    await page.getByText(/integration settings|налаштування інтеграції/i).click()
    
    // Check URL changed
    await expect(page).toHaveURL(/.*admin\/settings/)
  })

  test('should logout successfully', async ({ page }) => {
    // Click logout button in app bar
    await page.getByRole('button', { name: /logout|вихід/i }).click()
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/)
    await expect(page.getByLabel(/username|користувач/i)).toBeVisible()
  })
})
