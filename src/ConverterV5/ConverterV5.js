/**

 Converts glTF 2 to .XKT format V5.

 Experimental.

 Designed for accurate geometry.

 XKT V5 is designed for maximum geometry accuracy for a s

 XKT V5 features:

 - geometry arrays (positions, normals, indices, edgeIndices)
 - an array of modeling matrices
 - a list of primitives, each of which owns a portion of the geometry arrays
 - entities, each of which has a modeling matrix and a portion of the primitives, and can share primitives portions with other entities
 - floating point geometry positions (and therefore no positions decode matrices)

 */
const fs = require('fs');

const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

module.exports = {
    version: 5,
    desc: "Geometry reuse; Oct-encoded normals; 32-bit floating-point positions; EXPERIMENTAL",
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
        console.log("Writing XKT file " + xktPath);
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
