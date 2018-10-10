#! /usr/bin/env node

const program = require('commander');
const logger = require('../lib/logger');
const downloadAnimeRecursive = require('../lib/animeDownloader');
const Writer = require('../lib/writer');

program
  .version('0.0.1')
  .option('-e, --entity [entity]', 'Choose between "anime" and "character"')
  .option('-s, --start [start]', 'Number of start page')
  .option('-t, --stop [stop]', 'Number of stop page')
  .option('-o, --output [output]', 'Path to output folder', '')
  .parse(process.argv);

if (program.entity === undefined || program.start === undefined || program.start === undefined) {
  logger.error('Not all required parameters are provided.');
  process.exit(1);
} else {
  if (program.output === undefined) {
    program.output = process.cwd();
  }

  const writer = new Writer(program.output);

  if (program.entity === 'anime') {
    downloadAnimeRecursive(parseInt(program.start), parseInt(program.stop), writer);
  }
}