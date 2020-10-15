/*

 Converts glTF 2 to .XKT format V6.

 Features geometry reuse, oct-encoded normals, quantized positions, tiles with relative-to-center coordinates.

 */

const fs = require('fs');

const {XKTModel, loadGLTFIntoXKTModel, writeXKTModelToArrayBuffer} = require("@xeokit/xeokit-xkt-utils/dist/xeokit-xkt-utils.cjs.js");

module.exports = {
    version: 6,
    desc: "Full-precision geometry; Geometry reuse; Oct-encoded normals; Quantized positions;",
    convert: async function convert(gltfPath, xktPath) {

        const contents = await new Promise((resolve, reject) => {
            fs.readFile(gltfPath, (error, contents) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(contents);
            });
        });

        const gltf = JSON.parse(contents);
        const basePath = getBasePath(gltfPath);
        const xktModel = new XKTModel();

        await loadGLTFIntoXKTModel(gltf, xktModel, {basePath: basePath});

        await new Promise((resolve, reject) => {
            const xktArrayBuffer = writeXKTModelToArrayBuffer(xktModel);
            console.log("Writing XKT file: " + xktPath);
            fs.writeFile(xktPath, Buffer.from(xktArrayBuffer), (error) => {
                if (error !== null) {
                    console.error(`Unable to write to file at path: ${xktPath}`);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
};

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

