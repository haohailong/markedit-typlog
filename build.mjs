import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.js'],
  outfile: 'dist/markedit-typlog.js',
  bundle: true,
  format: 'iife',
  target: 'safari17',
  legalComments: 'eof',
  banner: { js: '// MarkEdit Typlog Publisher v0.3.7 — credentials are configured in the app, never in this script.' },
});
