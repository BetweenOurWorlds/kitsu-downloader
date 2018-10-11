#! /usr/bin/env node

const program = require('commander');
const logger = require('../lib/logger');
const AnimeDownloader = require('../lib/animeDownloader');
const CharacterDownloader = require('../lib/characterDownloader');
const Writer = require('../lib/writer');

program
  .version('0.0.1')
  .option('-e, --entity [entity]', 'Choose between "anime" and "character"')
  .option('-s, --start [start]', 'Number of start page')
  .option('-t, --stop [stop]', 'Number of stop page')
  .option('-o, --output [output]', 'Path to output folder', '')
  .option('-v, --verbose', 'Make the application more talkative', '')
  .parse(process.argv);

if (program.verbose) {
  //todo set level of logger
}

if (program.entity === undefined || program.start === undefined || program.start === undefined) {
  logger.error('Not all required parameters are provided.');
  process.exit(1);
} else {
  if (program.output === undefined) {
    program.output = process.cwd();
  }

  const writer = new Writer(program.output);
  let Downloader;

  if (program.entity === 'anime') {
    Downloader = AnimeDownloader;
  } else if (program.entity === 'character') {
    Downloader = CharacterDownloader;
  } else {
    logger.error(`-e expects the value "anime" or "character"`);
    process.exit(1);
  }

  const downloader = new Downloader(writer);
  downloader.downloadRecursive(parseInt(program.start), parseInt(program.stop));
}