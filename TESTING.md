# Testing Guide

Dieses Dokument beschreibt die Test-Infrastruktur und -Strategien fuer OpenIntraHub.

---

## Uebersicht

OpenIntraHub verwendet zwei Test-Frameworks:

| Bereich | Framework | Konfiguration |
|---------|-----------|---------------|
| **Backend** | Jest | `jest.config.js` |
| **Frontend** | Vitest | `frontend/vitest.config.js` |

---

## Backend Testing (Jest)

### Installation

```bash
npm install
```

### Test-Befehle

```bash
# Alle Tests ausfuehren
npm test

# Tests im Watch-Modus
npm run test:watch

# Mit Coverage-Report
npm run test:coverage

# Nur Unit Tests
npm run test:unit

# Nur Integration Tests
npm run test:integration

# CI/CD Modus
npm run test:ci
```

### Verzeichnisstruktur

```
tests/
├── setup.js                    # Test-Setup & Environment
├── mocks/
│   ├── database.mock.js       # PostgreSQL Mock
│   ├── logger.mock.js         # Winston Logger Mock
│   └── express.mock.js        # Request/Response Mocks
├── unit/
│   ├── auth.test.js           # Auth-Funktionen Tests
│   ├── permissions.test.js    # RBAC Tests
│   ├── middleware.test.js     # Middleware Tests
│   └── eventBus.test.js       # Event-System Tests
└── integration/
    ├── auth.api.test.js       # Auth API Tests
    └── posts.api.test.js      # Posts API Tests
```

### Test-Muster

#### Unit Test Beispiel

```javascript
const { hasPermission } = require('../../core/permissions');

describe('hasPermission', () => {
  it('should return true for admin with any permission', () => {
    expect(hasPermission('admin', 'users.create')).toBe(true);
  });

  it('should return false for user with admin permission', () => {
    expect(hasPermission('user', 'admin.settings')).toBe(false);
  });
});
```

#### Integration Test Beispiel

```javascript
const auth = require('../../core/auth');
const databaseMock = require('../mocks/database.mock');

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    databaseMock.resetMocks();
  });

  it('should login with valid credentials', async () => {
    databaseMock.mockQueryResult([{ /* user data */ }]);

    const req = createMockRequest({
      body: { username: 'testuser', password: 'password' }
    });
    const res = createMockResponse();

    await auth.login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json).toHaveProperty('token');
  });
});
```

### Mocks verwenden

#### Database Mock

```javascript
const databaseMock = require('../mocks/database.mock');

// Query-Ergebnis mocken
databaseMock.mockQueryResult([
  { id: 1, username: 'testuser' }
]);

// Query-Fehler mocken
databaseMock.mockQueryError(new Error('Connection failed'));

// Mocks zuruecksetzen
databaseMock.resetMocks();
```

#### Express Mocks

```javascript
const {
  createMockRequest,
  createMockResponse,
  createAuthenticatedRequest
} = require('../mocks/express.mock');

// Einfacher Request
const req = createMockRequest({
  body: { title: 'Test' },
  params: { id: '1' }
});

// Request mit authentifiziertem User
const authReq = createAuthenticatedRequest(
  { id: 1, role: 'admin' },
  { body: { data: 'test' } }
);

// Response mit Status pruefen
const res = createMockResponse();
// Nach Handler-Aufruf:
expect(res.status).toHaveBeenCalledWith(200);
expect(res._json).toEqual({ success: true });
```

---

## Frontend Testing (Vitest)

### Installation

```bash
cd frontend
npm install
```

### Test-Befehle

```bash
# Tests im Watch-Modus
npm test

# Einmaliger Test-Lauf
npm run test:run

# Mit Coverage
npm run test:coverage

# Mit UI (Browser)
npm run test:ui
```

### Verzeichnisstruktur

```
frontend/src/tests/
├── setup.js                           # Test-Setup & Mocks
├── utils.jsx                          # Test-Utilities
├── components/
│   └── UserStatusBadge.test.jsx      # Component Tests
├── hooks/
│   └── useUserStatus.test.jsx        # Hook Tests
└── services/
    └── api.test.js                    # API Service Tests
```

### Test-Muster

#### Component Test Beispiel

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserStatusBadge from '../../components/UserStatusBadge';

describe('UserStatusBadge', () => {
  it('should render correct color for available status', () => {
    render(<UserStatusBadge status="available" />);

    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-green-500');
  });
});
```

#### Hook Test Beispiel

```jsx
import { renderHook, act } from '@testing-library/react';
import { useUserStatus } from '../../hooks/useUserStatus';

describe('useUserStatus', () => {
  it('should update status', async () => {
    const { result } = renderHook(() => useUserStatus([]));

    await act(async () => {
      await result.current.updateMyStatus('away', 'BRB');
    });

    expect(result.current.error).toBeNull();
  });
});
```

### Test-Utilities

```jsx
import { renderWithProviders, mockUser } from './utils';

// Render mit Router und Providern
renderWithProviders(<MyComponent />, { route: '/dashboard' });

// Mock User Daten
console.log(mockUser); // { id: 1, username: 'testuser', ... }
```

---

## Coverage-Ziele

| Bereich | Ziel |
|---------|------|
| Branches | 50% |
| Functions | 50% |
| Lines | 50% |
| Statements | 50% |

Aktuelle Coverage kann mit `npm run test:coverage` eingesehen werden.

---

## Best Practices

### 1. Test-Isolation

```javascript
beforeEach(() => {
  // Mocks vor jedem Test zuruecksetzen
  jest.clearAllMocks();
  databaseMock.resetMocks();
});
```

### 2. Beschreibende Test-Namen

```javascript
// Gut
it('should return 401 for expired token', () => { });

// Vermeiden
it('test1', () => { });
```

### 3. AAA-Pattern (Arrange-Act-Assert)

```javascript
it('should create new post', async () => {
  // Arrange
  const postData = { title: 'Test', content: 'Content' };
  databaseMock.mockQueryResult([{ id: 1, ...postData }]);

  // Act
  await postsService.create(postData, userId);

  // Assert
  expect(databaseMock.query).toHaveBeenCalled();
});
```

### 4. Keine echten Datenbank-Verbindungen

Immer Mocks verwenden - keine echten DB-Verbindungen in Tests.

### 5. Edge Cases testen

```javascript
describe('input validation', () => {
  it('should reject empty username', () => { });
  it('should reject too long password', () => { });
  it('should handle special characters', () => { });
  it('should handle unicode', () => { });
});
```

---

## CI/CD Integration

### GitHub Actions Beispiel

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Backend Dependencies
        run: npm ci

      - name: Run Backend Tests
        run: npm run test:ci

      - name: Install Frontend Dependencies
        run: cd frontend && npm ci

      - name: Run Frontend Tests
        run: cd frontend && npm run test:run
```

---

## Troubleshooting

### Tests laufen nicht

```bash
# Cache loeschen
npm cache clean --force
rm -rf node_modules
npm install
```

### Mock funktioniert nicht

```javascript
// Mock muss VOR dem Import deklariert werden
jest.mock('../../core/database', () => require('../mocks/database.mock'));

// DANN erst importieren
const myModule = require('../../core/myModule');
```

### Async Tests schlagen fehl

```javascript
// Immer await oder done() verwenden
it('should work async', async () => {
  const result = await asyncFunction();
  expect(result).toBe(true);
});
```

---

## Weitere Ressourcen

- [Jest Dokumentation](https://jestjs.io/docs/getting-started)
- [Vitest Dokumentation](https://vitest.dev/guide/)
- [Testing Library](https://testing-library.com/docs/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
