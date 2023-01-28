
import builtins from 'builtin-modules'
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'

const rollupConfig = {
  input: 'index.js',
  plugins: [
    json(),
    commonjs(),
    nodeResolve({
      preferBuiltins: false
    }),
    esbuild({
      minify: true,
      legalComments: 'none'
    })
  ],
  external: builtins,
  output: {
    file: 'dist/index.cjs',
    format: 'cjs',
    sourcemap: true
  }
}

export default rollupConfig
