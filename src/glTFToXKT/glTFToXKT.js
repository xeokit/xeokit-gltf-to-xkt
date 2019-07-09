import {glTFToModel} from "./lib/glTFToModel.js";
import {modelToXKT} from "./lib/modelToXKT.js";

var fs = require("fs");

const glTFToXKT = (gltfSrc, xeokitSrc) => {

    console.log('[INFO] Converting glTF ' + gltfSrc + ' to ' + xeokitSrc);

    const content = fs.readFileSync(gltfSrc);

    const gltf = JSON.parse(content);

    const model = glTFToModel(gltf);

    const arrayBuffer = modelToXKT(model);

    fs.appendFile(xeokitSrc, new Buffer(arrayBuffer), (err) => {
        if (err) {
            console.error("fs.appendFile: " + err);
        }
    });
};

export {glTFToXKT};