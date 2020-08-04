/**

 Converts glTF 2 to .XKT format V3.

 Features geometry reuse, oct-encoded normals and quantized positions.

 See .XKT V3 specification: https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format-V3

 */
const fs = require('fs');

const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

module.exports = {
    version: 3,
    desc: "Geometry reuse; Oct-encoded normals; Quantized positions; RECOMMENDED",
    convert: async function convert(gltfPath, xktPath) {
        const content = await readGltf(gltfPath);
        const gltf = JSON.parse(content);
        const basePath = getBasePath(gltfPath);
        const model = await glTFToModel(gltf, {
            basePath: basePath
        });
        await writeXkt(xktPath, model);
    }
};

function readGltf(gltfPath) {
    return new Promise((resolve, reject) => {
        fs.readFile(gltfPath, (error, contents) => {
            if (error !== null) {
                reject(error);
                return;
            }
            resolve(contents);
        });
    });
}

function getBasePath(src) {
    var i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

function writeXkt(xktPath, model) {
    return new Promise((resolve, reject) => {
        const arrayBuffer = modelToXKT(model);
        console.log("Writing XKT file: " + xktPath);
        fs.writeFile(xktPath, Buffer.from(arrayBuffer), (error) => {
            if (error !== null) {
                console.error(`Unable to write to file at path: ${xktPath}`);
                reject(error);
                return;
            }
            resolve();
        });
    });
}
