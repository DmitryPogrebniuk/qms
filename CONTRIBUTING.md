# Contributing to Cisco QMS

Thank you for contributing! Please follow these guidelines.

## Code Style

- **TypeScript Strict Mode**: All files must compile without errors
- **ESLint**: Run `npm run lint` before committing
- **Prettier**: Run `npm run format` for automatic formatting
- **Comments**: Document complex business logic, not obvious code

## Commit Messages

```
[TYPE] Brief description

- Detailed change 1
- Detailed change 2

Closes #123
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code cleanup
- `docs`: Documentation
- `test`: Tests
- `chore`: Dependencies, tooling

## Branches

- `main`: Production-ready
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes

## Pull Request Process

1. Create feature branch from `develop`
2. Write tests for new code
3. Run: `npm run lint && npm run format && npm test`
4. Update documentation
5. Create PR with description of changes
6. Require 2 approvals before merge
7. Squash commits on merge

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# RBAC tests
npm run test:rbac

# Coverage
npm run test:coverage
```

Minimum coverage: **80%**

## Database Changes

1. Update `schema.prisma`
2. Run: `npx prisma migrate dev --name descriptive_name`
3. Commit both schema.prisma and migration folder
4. Test with: `npm run db:reset` (dev only)

## API Changes

1. Update endpoint in controller
2. Update validation DTOs
3. Update OpenAPI documentation (auto-generated)
4. Test with: `npm run dev`
5. Verify Swagger at http://localhost:3000/api

## Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for design changes
- Update API.md for endpoint changes
- Add inline comments for business logic

## Security

- Never commit secrets (.env files)
- Use `@Public()` decorator sparingly
- Always use `@RequireRoles()` for sensitive endpoints
- Validate all user input
- Use parameterized queries (Prisma handles this)

## Performance

- Query optimization: Run explain plans on complex queries
- Caching: Use Redis for frequently accessed data
- Indexing: Add indices for common filter combinations
- Async: Use async/await, not promises

## Questions?

- Check existing code for patterns
- Review ARCHITECTURE.md for design decisions
- Ask in pull request comments
- Create GitHub issue for clarification

---

**Code owners**: @team-qms  
**License**: MIT
