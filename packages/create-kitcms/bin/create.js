#!/usr/bin/env node
// Thin launcher: the CLI is compiled to dist/ (Node does not strip types inside node_modules).
import { main } from '../dist/index.js';

process.exitCode = await main(process.argv.slice(2));
