# Deployment Checklist

Run through this checklist before every production deployment.

## Pre-Deploy
- [ ] All tests pass (backend and frontend)
- [ ] No TODO/FIXME in changed files (unless tracked as work items)
- [ ] Environment variables documented (any new ones added to .env.example)
- [ ] Database migrations tested (run on a copy of production data if possible)
- [ ] No debug/development settings in production config
- [ ] Dependencies audited (no known critical vulnerabilities)

## During Deploy
- [ ] Deploy during low-traffic hours when possible
- [ ] Monitor error rates during rollout
- [ ] Verify health endpoint returns OK after deploy

## Post-Deploy
- [ ] Smoke test critical paths (login, main feature, payment if applicable)
- [ ] Check error monitoring (Sentry/equivalent) for new errors
- [ ] Verify no performance regression (page load times, API response times)

## Rollback Plan
- [ ] Know how to rollback (document the exact command)
- [ ] Database migrations are reversible (or have a manual rollback plan)
- [ ] If rollback is needed, do it immediately — don't debug in production

## What Blocks a Deploy
- Any failing test
- Any critical security vulnerability in dependencies
- Any migration that can't be reversed
- Missing environment variables for new features
