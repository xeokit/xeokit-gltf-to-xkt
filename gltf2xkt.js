#!/usr/bin/env node

const commander = require('commander');

const ConverterV1 = require('./src/ConverterV1/ConverterV1.js');
const ConverterV3 = require('./src/ConverterV3/ConverterV3.js');
const ConverterV4 = require('./src/ConverterV4/ConverterV4.js');
const ConverterV5 = require('./src/ConverterV5/ConverterV5.js');
const ConverterV6 = require('./src/ConverterV6/ConverterV6.js');

const converters = {};

converters[ConverterV1.version] = ConverterV1;
converters[ConverterV3.version] = ConverterV3;
converters[ConverterV4.version] = ConverterV4;
converters[ConverterV5.version] = ConverterV5;
converters[ConverterV6.version] = ConverterV6;

const defaultConverter = ConverterV3;

const program = new commander.Command();

program.version('0.0.4', '-v, --version');

program
    .option('-s, --source [file]', 'path to the source glTF file')
    .option('-o, --output [file]', 'path to the target xkt file')
    .option('-f  --format [number]', 'XKT format to write');

program.on('--help', () => {
    logSupportedFormats();
});

program.parse(process.argv);

if (program.source === undefined) {
    console.error('\n\nError: please specify source glTF path.');
    program.help();
    process.exit(1);
}

if (program.output === undefined) {
    console.error('\n\nError: please specify target xkt path.');
    program.help();
    process.exit(1);
}

let format = program.format;
let converter = null;

if (format === undefined) {
    converter = defaultConverter;
}

if (format !== undefined) {
    converter = converters[format];
    if (!converter) {
        console.error('\nError: unsupported XKT format: ' + format);
        logSupportedFormats();
        process.exit(1);
    }
}

console.log('\n\nWriting XKT format ' + converter.version + '.');

converter
    .convert(program.source, program.output)
    .catch((error) => {
        console.error('Something went wrong:', error);
        process.exit(1);
    });

function logSupportedFormats() {
    console.log('\nSupported XKT Formats:');
    for (let format in converters) {
        const converter = converters[format];
        console.log('  ' + converter.version + ' - ' + converter.desc);
    }
    console.log();
}

