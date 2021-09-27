#!/usr/bin/env node

const fs = require('fs').promises;
const commander = require('commander');
const package = require('./package.json');

const {
    XKT_INFO,
    XKTModel,
    parseGLTFIntoXKTModel,
    writeXKTModelToArrayBuffer,
    parseMetaModelIntoXKTModel
} = require("@xeokit/xeokit-convert/dist/xeokit-convert.cjs.js");

const program = new commander.Command();

program.version(package.version, '-v, --version');

program
    .option('-s, --source [file]', 'path to source glTF file')
    .option('-m, --metamodel [file]', 'path to source metamodel JSON file (optional)')
    .option('-o, --output [file]', 'path to target xkt file')
    .option('-l, --log', 'enable logging');

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

function log(msg) {
    if (program.log) {
        console.log("[gltf2xkt] " + msg);
    }
}

log('Reading glTF file: ' + program.source);

log('Converting to XKT');

async function main() {

    const startTime = new Date();

    const gltfBasePath = getBasePath(program.source);

    async function getAttachment(name, parsingContext) {
        return fs.readFile(gltfBasePath + name);
    }

    const gltfContent = await fs.readFile(program.source);
    let metaModelContent;
    if (program.metamodel) {
        const metaModelData = await fs.readFile(program.metamodel);
        metaModelContent = JSON.parse(metaModelData);
    }
    const stats = {};
    const xktArraybuffer = await convert(gltfContent, metaModelContent, getAttachment, stats);
    await fs.writeFile(program.output, xktArraybuffer);

    if (program.log) {
        const sourceFileSizeBytes = gltfContent.byteLength;
        const targetFileSizeBytes = xktArraybuffer.byteLength;
        stats.sourceSize = (sourceFileSizeBytes / 1000).toFixed(2) + " kB";
        stats.xktSize = (targetFileSizeBytes / 1000).toFixed(2) + " kB";
        stats.xktVersion = XKT_INFO.xktVersion;
        stats.compressionRatio = (sourceFileSizeBytes / targetFileSizeBytes).toFixed(2);
        stats.conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2) + " secs";
        for (let key in stats) {
            const value = stats[key];
            if (value !== undefined && value !== null && value !== "") {
                log(key + ": " + value);
            }
        }
    }
}

async function convert(gltfContent, metaModelContent, getAttachment, stats) {
    const xktModel = new XKTModel();
    if (metaModelContent) {
        await parseMetaModelIntoXKTModel({
          metaModelData: metaModelContent,
          xktModel,
        });
    }
    const gltf = JSON.parse(gltfContent);
    await parseGLTFIntoXKTModel({
        data: gltf,
        xktModel,
        getAttachment,
        stats,
        log
    });
    xktModel.finalize();
    stats.aabb = "[" + xktModel.aabb + "]";
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
