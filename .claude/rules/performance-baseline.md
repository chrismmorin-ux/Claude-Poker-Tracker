# Performance Baseline

## Universal Rules
- **Page load under 3 seconds.** Measure from navigation start to largest contentful paint. If slower, investigate.
- **API responses under 500ms.** Standard CRUD operations should respond in <500ms. Complex queries in <2s. Anything slower needs optimization.
- **No N+1 queries.** If a page triggers 50 database queries to show 50 items, that's an N+1 problem. Use eager loading, joins, or batch queries.
- **Images optimized.** Use WebP/AVIF, lazy loading, and appropriate sizes. No 5MB hero images.
- **Database queries have indexes.** Any column used in WHERE, JOIN, or ORDER BY should have an index. Check with EXPLAIN.
- **Pagination for lists.** Never return unbounded result sets. Default page size of 25-50 items.

## When to Optimize
- **Before launch:** Measure and fix the worst offenders
- **After launch:** Monitor real user metrics, fix what users actually hit
- **Never:** Premature optimization of code that runs once a day

## Stack-Specific

### Django
- Use `select_related()` and `prefetch_related()` for foreign key queries
- Use Django Debug Toolbar in development to spot N+1 queries
- Cache expensive queries with Django's cache framework

### Next.js/React
- Use `next/image` for automatic image optimization
- Implement code splitting with dynamic imports
- Use React.memo and useMemo for expensive computations (not everywhere)
