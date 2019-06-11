import {Model} from "./src/Model.js";
import {parseGLTFIntoModel} from "./src/parseGLTFIntoModel.js";
import {serializeModelToArrayBuffer} from "./src/serializeModelToArrayBuffer.js";

var fs = require("fs");

convert("./models/gltf/OTCConferenceCenter/scene.gltf", "./models/xeokit/otcConferenceCenter.xeokit");
convert("./models/gltf/schependomlaan/scene.gltf", "./models/xeokit/schependomlaan.xeokit");
convert("./models/gltf/gearbox/scene.gltf", "./models/xeokit/gearbox.xeokit");
convert("./models/gltf/duplex/scene.gltf", "./models/xeokit/duplex.xeokit");

function convert(gltfSrc, xeokitSrc) {

    console.log('[INFO] Converting model:' + gltfSrc);

    const content = fs.readFileSync(gltfSrc);
    const gltf = JSON.parse(content);
    const model = new Model();

    parseGLTFIntoModel(gltf, model);

    const arrayBuffer = serializeModelToArrayBuffer(model);

    fs.appendFile(xeokitSrc, new Buffer(arrayBuffer), function (err) {
        if (err) {
            console.error(err);
        }
    });
}
