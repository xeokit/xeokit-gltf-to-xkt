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
    desc: "Geometry reuse; Oct-encoded normals; Quantized positions;",
    convert: function convert(gltfContent, getAttachment) {
        const gltf = JSON.parse(gltfContent);
        const model = glTFToModel(gltf, getAttachment);
        const arrayBuffer = modelToXKT(model);
        return Buffer.from(arrayBuffer);
    }
};
