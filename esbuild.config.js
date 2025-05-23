const esbuild = require('esbuild');

const isWatchMode = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  platform: 'browser',
  target: ['es6'],
  format: 'iife',
  minify: false,
  sourcemap: true,
};

if (isWatchMode) {
  esbuild.context(buildOptions).then(context => {
    context.watch();
    console.log('Watching for changes...');
  }).catch(() => process.exit(1));
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('Build completed successfully!');
  }).catch(() => process.exit(1));
} 