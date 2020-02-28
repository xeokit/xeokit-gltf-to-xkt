const fs = require('fs');
const glTFToModel = require('./glTFToModel');
const modelToXKT = require('./modelToXKT');

/**
 * The Converter class takes the path to the origin `.gltf` file and converts
 * it to and `.xkt` file at the specified path.
 *
 * The file handling is asynchronous and non-blocking, the `convert()` method
 * returns a `Promise`.
 */
class Converter {

    /**
     * Creates and returns an instance of the `Converter`.
     * @param gltfPath The path to the source `gltf` file.
     * @param xktPath The path of the output `xkt` file.
     */
    constructor(gltfPath, xktPath) {
        this.gltfPath = gltfPath;
        this.xktPath = xktPath;
    }

    /**
     * The asynchronous `convert()` method initiates the conversion. First, the
     * `gltf` is loaded into the memory as a `Model`, then the `modelToXKT`
     * outputs the `xkt` file at the desitnation.
     * @returns {Promise<void>} Returns a promise, which is resolved when the
     * operation completes.
     */
    async convert() {
        console.log('Starting conversion.', this.gltfPath);
        const content = await this.readGltf();
        const gltf = JSON.parse(content);
        const basePath = getBasePath(this.gltfPath);
        console.log(basePath);
        this.model = await glTFToModel(gltf, {
            basePath: basePath
        });
        await this.writeXkt();
        console.log('Conversion completed.', this.xktPath);
    }


    /**
     * Reads the contents of the `gltf` file and returns it.
     * @returns {Promise<any>} Returns a promise of the contents of the file.
     */
    readGltf() {
        return new Promise((resolve, reject) => {
            fs.readFile(this.gltfPath, (error, contents) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(contents);
            });
        });
    }

    /**
     * Uses the `modelToXKT` to create the `xkt` representation of the `gltf`
     * model.
     * @returns {Promise<void>} Returns a promise, which is resolved when the
     * operation completes.
     */
    writeXkt() {
        return new Promise((resolve, reject) => {
            const arrayBuffer = modelToXKT(this.model);

            fs.writeFile(this.xktPath, Buffer.from(arrayBuffer), (error) => {
                if (error !== null) {
                    console.error(`Unable to write to file at path: ${this.xktPath}`);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
}

function getBasePath(src) {
    var i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

module.exports = Converter;
