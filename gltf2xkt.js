#!/usr/bin/env node

const fs = require('fs').promises;
const commander = require('commander');

const {converters, defaultConverter, getBasePath} = require('./lib/index.js');

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


async function main() {
    const gltfBasePath = getBasePath(program.source);

    async function getAttachment(name, parsingContext) {
        return fs.readFile(gltfBasePath + name);
    }

    const gltfContent = await fs.readFile(program.source);
    const xktContent = await converter.convert(gltfContent, getAttachment);
    await fs.writeFile(program.output, xktContent);
};

main().catch(err => {
    console.error('Something went wrong:', err);
    process.exit(1);
});
