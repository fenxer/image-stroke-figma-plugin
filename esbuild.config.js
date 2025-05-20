const esbuild = require('esbuild');

// 检查是否使用 watch 模式
const isWatchMode = process.argv.includes('--watch');

// 基本构建配置
const buildOptions = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  platform: 'browser',
  target: ['es6'],
  format: 'iife', // 使用立即执行函数表达式格式
  minify: false,  // 开发时可以设为 false 方便调试
  sourcemap: true,
};

// 根据是否为 watch 模式执行不同的构建
if (isWatchMode) {
  // 使用 watch 模式
  esbuild.context(buildOptions).then(context => {
    context.watch();
    console.log('Watching for changes...');
  }).catch(() => process.exit(1));
} else {
  // 单次构建
  esbuild.build(buildOptions).then(() => {
    console.log('Build completed successfully!');
  }).catch(() => process.exit(1));
} 