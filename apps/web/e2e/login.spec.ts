import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/QMS/)
    await expect(page.getByRole('heading', { name: /вхід до QMS/i })).toBeVisible()
  })

  test('should show username and password fields', async ({ page }) => {
    await expect(page.getByLabel(/користувач/i)).toBeVisible()
    await expect(page.getByLabel(/пароль/i)).toBeVisible()
  })

  test('should show demo credentials hint', async ({ page }) => {
    await expect(page.getByText(/boss \/ boss/i)).toBeVisible()
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.getByLabel(/користувач/i).fill('boss')
    await page.getByLabel(/пароль/i).fill('boss')
    
    // Click login button
    await page.getByRole('button', { name: /вхід/i }).click()
    
    // Wait for navigation to dashboard
    await page.waitForURL(/.*dashboard/)
    
    // Check that we're on the dashboard
    await expect(page.getByText(/dashboard\.welcome/i)).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in login form with wrong credentials
    await page.getByLabel(/користувач/i).fill('wrong')
    await page.getByLabel(/пароль/i).fill('wrong')
    
    // Click login button
    await page.getByRole('button', { name: /вхід/i }).click()
    
    // Wait for error message
    await expect(page.getByText(/fail|error|invalid/i)).toBeVisible({ timeout: 5000 })
  })

  test('should not submit with empty fields', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /вхід/i })
    
    // Click without filling fields
    await loginButton.click()
    
    // Should still be on login page
    await expect(page.getByLabel(/користувач/i)).toBeVisible()
  })
})
