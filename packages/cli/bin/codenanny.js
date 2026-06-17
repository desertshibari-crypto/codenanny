#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
