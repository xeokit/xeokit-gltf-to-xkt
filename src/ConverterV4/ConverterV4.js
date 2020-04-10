/*

 Converts glTF 2 to .XKT format V4.

 Experimental.

 Designed for accurate geometry and minimal size for geographically large models with fine details.

 An example of such a model would be a long street with a building at each end, with each building having many small
 elements, such as electrical fittings etc.

 To achieve minimal file size, V4 quantizes geometry positions to unsigned 16-bit integers. The positions in such a
 model would not retain acceptable precision if they were all quantized collectively into the same unsigned 16-bit
 integer range. Therefore, V4 subdivides the positions into portions, and quantizes each portion separately to the
 full 16-bit unsigned integer range. Each portion has its own decode matrix, to de-quantize its positions back
 to 32-bit floats, independently of the other portions.

 V4 holds geometry in a single set of positions, normals, indices and edgeIndices arrays.

 Each primitive owns a portion of the geometry arrays.

 Each primitive is owned by one or more entities.

 An entity can own multiple primitives.

 When a primitive is owned by exactly one entity, then its geometry positions are in World-space.

 When a primitive is owned by multiple entities ("instanced"), then its positions are in Model-space. The entities
 that own it will then each have a matrix to transform the primitive's positions into World-space for that entity.

 If an entity owns some primitives, and shares those primitives with other entities, then it shares that complete set
 of primitives, as a unit, with the other entities.

 An entity that does not share its primitives with other entities has an identity modeling matrix, which is effectively
 a null matrix, since the primitives positions are already in World-space and the matrix is not needed.

 Entities can share modeling matrices with other entities.

 */

const fs = require('fs');

const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

module.exports = {
    version: 4,
    desc: "Geometry reuse; Oct-encoded normals; Quantized positions; Positions quantized in partitions; EXPERIMENTAL",
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
