/*

 Converts glTF 2 to .XKT format V6.

 Features geometry reuse, oct-encoded normals, quantized positions, tiles with relative-to-center coordinates.

 */

const {XKTModel, loadGLTFIntoXKTModel, writeXKTModelToArrayBuffer} = require("@xeokit/xeokit-xkt-utils/dist/xeokit-xkt-utils.cjs.js");

module.exports = {
    version: 6,
    desc: "Full-precision geometry; Geometry reuse; Oct-encoded normals; Quantized positions;",
    convert: async function convert(gltfContent, getAttachment) {
        const xktModel = new XKTModel();
        const gltf = JSON.parse(gltfContent);
        await loadGLTFIntoXKTModel(gltf, xktModel, getAttachment);
        xktModel.finalize();
        const xktArrayBuffer = writeXKTModelToArrayBuffer(xktModel);
        return Buffer.from(xktArrayBuffer);
    }
};
