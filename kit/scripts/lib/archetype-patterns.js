// Archetype-based file-pattern defaults for CWOS program scopes.
// Single source of truth — both cwos-adopt-install.js (install-time patch)
// and cwos-scope-check.js (post-install drift detection) import from here.

// Archetype → default source-code file patterns for program scopes
const ARCHETYPE_PATTERNS = {
  saas:            ['**/*.py', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  frontend:        ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.css', '**/*.scss', '**/*.html'],
  'data-platform': ['**/*.py', '**/*.sql', '**/*.ipynb'],
  'dev-tool':      ['**/*.js', '**/*.ts', '**/*.py', '**/*.go', '**/*.rs'],
  research:        ['**/*.py', '**/*.ipynb', '**/*.r', '**/*.R'],
  'research-clinical':     ['**/*.py', '**/*.ipynb', '**/*.r', '**/*.R', '**/primitives/**', '**/anatomy/**'],
  'research-mathematical': ['**/*.py', '**/*.ipynb', '**/*.tex', '**/derivations/**', '**/proofs/**'],
  'research-empirical':    ['**/*.py', '**/*.ipynb', '**/*.r', '**/*.R', '**/data/**', '**/experiments/**'],
  'api-service':   ['**/*.py', '**/*.js', '**/*.ts', '**/*.go', '**/*.rs'],
};

// Per-program overrides for programs with semantic (non-language) patterns.
// Programs not listed here get ARCHETYPE_PATTERNS as their file_patterns.
const PROGRAM_PATTERN_OVERRIDES = {
  security: {
    base: ['**/*auth*', '**/*security*', '**/*login*', '**/*password*',
           '**/*token*', '**/*session*', '**/*.env*', '**/middleware*', '**/config*'],
  },
  ux: {
    skip_archetypes: ['data-platform', 'api-service', 'research'],
    base: ['**/*.jsx', '**/*.tsx', '**/*.css', '**/*.scss', '**/*.html',
           '**/components/**', '**/pages/**', '**/views/**', '**/templates/**'],
  },
  infrastructure: {
    base: ['**/.github/**', '**/Dockerfile*', '**/docker-compose*',
           '**/*.tf', '**/Makefile', '**/CI*', '**/.gitlab-ci*'],
  },
  'change-management': {
    base: ['**/docs/**', '**/*.md', '**/CHANGELOG*', '**/README*', '{system_dir}/**'],
  },
};

module.exports = { ARCHETYPE_PATTERNS, PROGRAM_PATTERN_OVERRIDES };
