#!/usr/bin/env node

const commander = require('commander');
const Converter = require('./src/Converter');

const program = new commander.Command();
program.version('0.0.1', '-v, --version');

program
  .option('-s, --source [file]', 'The path to the source gltf file.')
  .option('-o, --output [file]', 'The path to the target xkt file.');

program.parse(process.argv);

if (program.source === undefined) {
  console.error('\n\nPlease specify source gltf path.');
  program.help();
}

if (program.output === undefined) {
  console.error('\n\nPlease specify target xkt path..');
  program.help();
}

const gltf2xkt = new Converter(program.source, program.output);

gltf2xkt
  .convert()
  .catch((error) => {
    console.error('Something went wrong:', error);
    process.exit(1);
  });
