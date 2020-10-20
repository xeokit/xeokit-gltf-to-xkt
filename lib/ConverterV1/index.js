/**

 Converts glTF 2 to .XKT format V1.

 Oct-encoded normals; Quantized positions; No geometry reuse

 DEPRECATED

 .XKT V1 specification: https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format-V1

 */
const fs = require('fs');

const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

module.exports = {
    version: 1,
    desc: "Oct-encoded normals; Quantized positions; No geometry reuse;",
    convert: function convert(gltfContent) {
        const gltf = JSON.parse(gltfContent);
        const model = glTFToModel(gltf);
        const arrayBuffer = modelToXKT(model);
        return Buffer.from(arrayBuffer);
    }
};
