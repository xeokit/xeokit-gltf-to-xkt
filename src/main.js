'use strict';
import {glTFToModel} from "./lib/glTFToModel.js";
import {modelToXKT} from "./lib/modelToXKT.js";

var fs = require("fs");

function glTFToXKT(gltfData) {
    const gltf = JSON.parse(gltfData);
    const model = glTFToModel(gltf);
    const arrayBuffer = modelToXKT(model);
    return new Buffer.from(arrayBuffer);
};

export {glTFToXKT};
