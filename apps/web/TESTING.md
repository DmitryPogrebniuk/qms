# QMS UI Testing

Comprehensive UI testing suite for the Cisco QMS application.

## Test Types

### 1. Unit/Component Tests (Vitest + React Testing Library)
Tests individual React components in isolation.

**Run Tests:**
```bash
# Run all unit tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage report
npm run test:coverage
```

**Location:** `src/tests/components/`

**Test Files:**
- `Login.test.tsx` - Login form component tests
- `Dashboard.test.tsx` - Dashboard component tests

### 2. End-to-End Tests (Playwright)
Tests complete user flows through the application.

**Setup:**
```bash
# Install Playwright browsers (first time only)
npx playwright install
```

**Run E2E Tests:**
```bash
# Install Playwright browsers first (local machine only)
npx playwright install

# Run all E2E tests (requires services running on localhost:5173 and localhost:3000)
npm run test:e2e

# Run with Playwright UI (interactive mode)
npm run test:e2e:ui

# View last test report
npm run test:e2e:report
```

**Note:** E2E tests require the application to be running. Start services first:
```bash
docker-compose -f infra/docker-compose.yml up -d
```

**Location:** `e2e/`

**Test Scenarios:**
- `login.spec.ts` - User authentication flows
  - Display login page
  - Valid login
  - Invalid credentials
  - Empty fields validation
  
- `navigation.spec.ts` - Navigation and menu functionality
  - Menu button display
  - Navigation drawer
  - Admin menu access
  - Page navigation
  - Logout functionality
  
- `admin-settings.spec.ts` - Admin panel access and features
  - Admin settings page display
  - User management tab
  - Multiple settings tabs
  - Non-admin access prevention

## Test Configuration

- **Vitest Config:** `vitest.config.ts`
- **Playwright Config:** `playwright.config.ts`
- **Test Setup:** `src/tests/setup.ts`

## Running Tests in Docker

Tests can be run inside the Docker container:

```bash
# Enter the web container
docker exec -it qms-web sh

# Run unit tests
npm test

# For E2E tests, ensure services are running:
docker-compose -f infra/docker-compose.yml up -d
npm run test:e2e
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Unit Tests
  run: |
    cd apps/web
    npm test

- name: Run E2E Tests
  run: |
    cd apps/web
    npx playwright install --with-deps
    npm run test:e2e
```

## Test Coverage

Generate coverage report:
```bash
npm run test:coverage
```

View coverage report in `coverage/index.html`

## Writing New Tests

### Component Test Example:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### E2E Test Example:
```typescript
import { test, expect } from '@playwright/test'

test('my test', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Welcome')).toBeVisible()
})
```

## Best Practices

1. **Test User Behavior** - Focus on what users do, not implementation details
2. **Use Accessible Queries** - Prefer `getByRole`, `getByLabel` over `getByTestId`
3. **Avoid Testing Implementation** - Test behavior, not internal state
4. **Keep Tests Independent** - Each test should run in isolation
5. **Use Good Test Names** - Describe what the test does clearly

## Troubleshooting

**Playwright browser not found:**
```bash
npx playwright install
```

**Tests timing out:**
- Increase timeout in test config
- Check if services are running
- Review test selectors

**Mock data not working:**
- Check mock setup in `src/tests/setup.ts`
- Verify mocks are cleared in `beforeEach`

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
