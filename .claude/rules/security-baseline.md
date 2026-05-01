# Security Baseline

These rules apply to ALL code changes. Violations should be flagged before commit.

## Universal Rules
- **No secrets in code.** API keys, passwords, tokens, and connection strings go in environment variables, never in source files. If you find a secret in code, remove it immediately and rotate the credential.
- **No .env files committed.** `.env` must be in `.gitignore`. If `.env` was ever committed, the secrets in it are compromised — rotate them.
- **HTTPS everywhere.** All external API calls use HTTPS. No HTTP endpoints in production.
- **Input validation on all user-facing endpoints.** Never trust user input. Validate types, lengths, and ranges before processing.
- **SQL parameterization.** Never concatenate user input into SQL queries. Use parameterized queries or ORM methods.
- **Auth tokens must expire.** No permanent access tokens. Set reasonable expiration (hours for access tokens, days for refresh tokens).
- **Principle of least privilege.** Users and services get the minimum permissions needed. Admin access is not the default.

## Stack-Specific
<!-- /adopt customizes this section based on detected tech stack -->

### Python/Django
- Use Django's ORM for database queries (built-in SQL injection protection)
- Enable CSRF protection on all forms (`{% csrf_token %}`)
- Use `@login_required` or `IsAuthenticated` on all views that need auth
- Set `SECURE_BROWSER_XSS_FILTER = True`, `SECURE_CONTENT_TYPE_NOSNIFF = True`

### Node.js/Express
- Use `helmet` middleware for HTTP security headers
- Use `express-rate-limit` on auth endpoints
- Sanitize user input with `validator.js` or equivalent
- Use `bcrypt` or `argon2` for password hashing (never MD5/SHA1)

### React/Next.js
- Never use `dangerouslySetInnerHTML` with user-provided content
- Validate all props from API responses before rendering
- Use Content Security Policy headers
