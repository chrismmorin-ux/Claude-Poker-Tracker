# Error Handling

## Universal Rules
- **Log errors with context.** Every error log should include: what was being attempted, what input triggered it, and the full stack trace. "Error occurred" is never acceptable.
- **Never swallow exceptions silently.** Every catch block must either handle the error meaningfully or re-throw it. Empty catch blocks are bugs.
- **User-facing errors must be non-technical.** Users see "Something went wrong with your payment. Please try again." not "NullPointerException at PaymentService.java:42".
- **Financial/payment errors fail safely.** If a payment operation fails mid-way, ensure no partial charges occur. Log the full context for manual resolution.
- **Distinguish expected vs unexpected errors.** Validation errors (bad input) are expected — return helpful messages. System errors (database down) are unexpected — log, alert, return generic message.
- **Include correlation IDs.** Every request should have a unique ID that appears in logs, error responses, and monitoring. This makes debugging possible.

## Stack-Specific

### Python
- Use specific exception types (`ValueError`, `PermissionError`), not bare `except:`
- Use `logging.exception()` to capture stack traces automatically
- Use context managers (`with`) for resource cleanup

### JavaScript/TypeScript
- Use typed error classes (extend `Error`) for different failure modes
- Always `await` promises — unhandled rejections crash Node.js
- Use `try/catch` around all async operations
