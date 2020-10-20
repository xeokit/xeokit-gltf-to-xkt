#!/usr/bin/env node

const fs = require('fs');
const async = require('async');
const commander = require('commander');
const {getBasePath} = require('./src/lib/utils.js');

const {converters, defaultConverter} = require('./src/index.js');

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


function logSupportedFormats() {
    console.log('\nSupported XKT Formats:');
    for (let format in converters) {
        const converter = converters[format];
        console.log('  ' + converter.version + ' - ' + converter.desc + (defaultConverter.version === converter.version ? " (DEFAULT)" : ""));
    }
    console.log();
}


console.log('\n\nReading glTF file: ' + program.source);

console.log('Converting to XKT format: ' + converter.version);


function getAttachment(name) {
    return fs.readFileSync(gltfBasePath + name);
}

async.waterfall([
    function loadGltf(cb) {
        fs.readFile(program.source, cb);
    },
    async function convertGltf(gltfContent) {
        const gltfBasePath = getBasePath(program.source);
        return converter.convert(gltfContent, getAttachment);
    },
    function saveXkt(xktContent, cb) {
        fs.writeFile(program.output, xktContent, cb);
    }
], err => {
    if(err) {
        console.error('Something went wrong:', err);
        process.exit(1);
    }
});
