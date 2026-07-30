/**
 * cli — the uniform command-line contract for kit/scripts/.
 *
 * Every cwos-* script that a session may invoke ad hoc should route its argv
 * through here. The contract has exactly two guarantees, and both exist to stop
 * a session burning turns discovering an interface by trial and error:
 *
 *   1. `--help` / `-h` ALWAYS prints usage and exits 0 — and NEVER performs the
 *      script's action. (`cwos-session-recovery.js --help` used to run recovery.)
 *   2. An unrecognized flag is FATAL (exit 2) and NEVER performs the action.
 *      Silently ignoring it is how `cwos-verify.js --quick` ran a full 10-minute
 *      verify instead of failing in a millisecond.
 *
 * Guarantee 2 is the load-bearing one. A script that ignores flags it does not
 * understand will happily do the wrong, expensive thing while looking like it
 * obeyed. Fail closed instead: refuse to act on an instruction you didn't parse.
 *
 * Note on declaring specs: many scripts here look flags up dashless, via
 * `parseFlag(args, 'track')`, so a spec cannot be reliably derived from source
 * by scanning for '--track' literals. Specs are therefore declared explicitly.
 *
 * Zero dependencies. Pure CommonJS.
 */

'use strict';

/** Levenshtein distance, capped — only used to suggest a near-miss flag name. */
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

function suggest(unknown, known) {
  const bare = unknown.replace(/^--?/, '');
  let best = null;
  let bestD = Infinity;
  for (const k of known) {
    const d = editDistance(bare, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  // Only suggest when it is plausibly a typo, not a wild guess.
  const threshold = Math.max(2, Math.floor(bare.length / 3));
  return best && bestD <= threshold ? `--${best}` : null;
}

/**
 * Render the usage block. Deterministic, so it can be asserted in tests.
 * @param {object} spec
 */
function formatUsage(spec) {
  const lines = [];
  const flags = spec.flags || {};
  const subs = spec.subcommands || null;

  if (spec.summary) lines.push(`${spec.name} — ${spec.summary}`, '');

  const usageLine = spec.usage
    || `${spec.name}${subs ? ' <' + Object.keys(subs).join('|') + '>' : ''}${Object.keys(flags).length ? ' [options]' : ''}`;
  lines.push(`usage: ${usageLine}`);

  if (subs && Object.keys(subs).length) {
    lines.push('', 'subcommands:');
    const w = Math.max(...Object.keys(subs).map((k) => k.length));
    for (const [k, v] of Object.entries(subs)) {
      lines.push(`  ${k.padEnd(w)}  ${typeof v === 'string' ? v : (v.describe || '')}`);
    }
  }

  // --help is rendered as a first-class option so it shares the alignment
  // column with everything else.
  const rendered = Object.entries(flags).map(([k, f]) => {
    const val = f.type === 'string'
      ? (f.optionalValue ? ` [${f.placeholder || k}]` : ` <${f.placeholder || k}>`)
      : '';
    const alias = f.alias ? `-${f.alias}, ` : '';
    return { left: `  ${alias}--${k}${val}`, describe: f.describe || '' };
  });
  rendered.push({ left: '  -h, --help', describe: 'print this usage and exit without acting' });

  lines.push('', 'options:');
  const w = Math.max(...rendered.map((r) => r.left.length));
  for (const r of rendered) lines.push(`${r.left.padEnd(w)}  ${r.describe}`);

  if (spec.notes) lines.push('', spec.notes);
  return lines.join('\n') + '\n';
}

/**
 * Pure parser — returns a result object, never exits. Use this in tests.
 *
 * @param {string[]} argv    typically process.argv.slice(2)
 * @param {object}   spec    { name, summary, usage, flags, subcommands, notes }
 * @returns {{ok:boolean, help?:boolean, error?:string, values?:object,
 *            positionals?:string[], sub?:string, usage:string}}
 */
function parseCli(argv, spec) {
  const usage = formatUsage(spec);
  const flags = spec.flags || {};
  const subs = spec.subcommands || null;

  // Alias map: -q -> quiet
  const byAlias = new Map();
  for (const [k, f] of Object.entries(flags)) {
    if (f.alias) byAlias.set(f.alias, k);
  }

  // Help wins over everything, and is checked before any validation, so that
  // `--help` on a malformed command line still explains rather than scolds.
  if (argv.includes('--help') || argv.includes('-h')) {
    return { ok: true, help: true, usage };
  }

  const values = {};
  for (const [k, f] of Object.entries(flags)) {
    if ('default' in f) values[k] = f.default;
    else if (f.type === 'boolean') values[k] = false;
  }

  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') { positionals.push(...argv.slice(i + 1)); break; }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const rawName = (eq === -1 ? arg.slice(2) : arg.slice(2, eq));
      const inlineVal = eq === -1 ? null : arg.slice(eq + 1);
      const f = flags[rawName];
      if (!f) {
        const hint = suggest(arg, Object.keys(flags));
        return {
          ok: false,
          usage,
          error: `unknown flag: ${arg}${hint ? ` (did you mean ${hint}?)` : ''}`,
        };
      }
      if (f.type === 'string') {
        // Peek before consuming: an optional-value flag must not swallow the
        // flag that follows it (`--since-git-commit --quiet`).
        const peek = inlineVal !== null ? inlineVal : argv[i + 1];
        const absent = peek === undefined || (typeof peek === 'string' && peek.startsWith('--'));
        if (absent) {
          if (f.optionalValue) { values[rawName] = true; continue; }
          return { ok: false, usage, error: `flag --${rawName} requires a value` };
        }
        if (inlineVal === null) i++;  // consume the value we just peeked
        values[rawName] = peek;
      } else {
        if (inlineVal !== null && !/^(true|false)$/.test(inlineVal)) {
          return { ok: false, usage, error: `flag --${rawName} is a boolean and takes no value` };
        }
        values[rawName] = inlineVal === null ? true : inlineVal === 'true';
      }
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1 && arg !== '-') {
      const aliasName = byAlias.get(arg.slice(1));
      if (!aliasName) {
        return { ok: false, usage, error: `unknown flag: ${arg}` };
      }
      const f = flags[aliasName];
      if (f.type === 'string') {
        const peek = argv[i + 1];
        const absent = peek === undefined || peek.startsWith('--');
        if (absent) {
          if (f.optionalValue) { values[aliasName] = true; continue; }
          return { ok: false, usage, error: `flag -${arg.slice(1)} requires a value` };
        }
        i++;
        values[aliasName] = peek;
      } else {
        values[aliasName] = true;
      }
      continue;
    }

    positionals.push(arg);
  }

  let sub;
  if (subs) {
    sub = positionals.shift();
    if (!sub) {
      return { ok: false, usage, error: `a subcommand is required` };
    }
    if (!Object.prototype.hasOwnProperty.call(subs, sub)) {
      const hint = suggest(sub, Object.keys(subs));
      return {
        ok: false,
        usage,
        error: `unknown subcommand: ${sub}${hint ? ` (did you mean ${hint.replace(/^--/, '')}?)` : ''}`,
      };
    }
  }

  // Required string flags.
  for (const [k, f] of Object.entries(flags)) {
    if (f.required && (values[k] === undefined || values[k] === null)) {
      return { ok: false, usage, error: `missing required flag: --${k}` };
    }
  }

  return { ok: true, values, positionals, sub, usage };
}

/**
 * Exiting wrapper. Call this at the very top of main(), BEFORE any side effect.
 *
 * On `--help` it writes usage to stdout and exits 0.
 * On a bad command line it writes the error + usage to stderr and exits 2.
 * Otherwise it returns { values, positionals, sub }.
 */
function cliGate(argv, spec) {
  const r = parseCli(argv, spec);
  if (r.help) {
    process.stdout.write(r.usage);
    process.exit(0);
  }
  if (!r.ok) {
    process.stderr.write(`${spec.name}: ${r.error}\n\n${r.usage}`);
    process.exit(2);
  }
  return { values: r.values, positionals: r.positionals, sub: r.sub };
}

module.exports = { cliGate, parseCli, formatUsage };
