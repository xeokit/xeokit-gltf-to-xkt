#!/usr/bin/env node

const fs = require('fs').promises;
const commander = require('commander');
const package = require('./package.json');

const {
    XKTModel,
    parseGLTFIntoXKTModel,
    writeXKTModelToArrayBuffer
} = require("@xeokit/xeokit-xkt-utils/dist/xeokit-xkt-utils.cjs.js");

const program = new commander.Command();

program.version(package.version, '-v, --version');

program
    .option('-s, --source [file]', 'path to the source glTF file')
    .option('-o, --output [file]', 'path to the target xkt file');

program.on('--help', () => {

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

console.log('\n\nReading glTF file: ' + program.source);

console.log('Converting to XKT format v7');

async function main() {
    const gltfBasePath = getBasePath(program.source);

    async function getAttachment(name, parsingContext) {
        return fs.readFile(gltfBasePath + name);
    }

    const gltfContent = await fs.readFile(program.source);
    const xktContent = await convert(gltfContent, getAttachment);
    await fs.writeFile(program.output, xktContent);
}

async function convert(gltfContent, getAttachment) {
    const xktModel = new XKTModel();
    const gltf = JSON.parse(gltfContent);
    await parseGLTFIntoXKTModel(gltf, xktModel, getAttachment);
    xktModel.finalize();
    const xktArrayBuffer = writeXKTModelToArrayBuffer(xktModel);
    return Buffer.from(xktArrayBuffer);
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

main().catch(err => {
    console.error('Something went wrong:', err);
    process.exit(1);
});
