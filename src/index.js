'use strict';
const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

module.exports = function glTFToXKT(gltfData) {
    const gltf = JSON.parse(gltfData);
    const model = glTFToModel(gltf);
    const arrayBuffer = modelToXKT(model);
    return new Buffer.from(arrayBuffer);
};
