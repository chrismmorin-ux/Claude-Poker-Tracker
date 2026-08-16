// Resolve the repo's extensionless relative imports the way Vite does.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const suffix of ['.js', '.jsx', '/index.js']) {
        try { return await nextResolve(specifier + suffix, context); } catch { /* next */ }
      }
    }
    throw err;
  }
}
