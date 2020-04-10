const math = require('../lib/math');

const geometryCompression = require('../lib/geometryCompression');

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);

/**
 * Contains the output of {@link glTFToModel}.
 */
class Model {

    constructor() {
        this.primitives = [];
        this.entities = [];
    }

    createPrimitive(params) {
        this.primitives.push(params);
    }

    createEntity(params) {
        this.entities.push(params);
    }

    /**
     * Finalizes this model, preparing the data for writing to XKT.
     */
    finalize() {

        for (let primitiveIndex = 0, numPrimitives = this.primitives.length; primitiveIndex < numPrimitives; primitiveIndex++) {

            const primitive = this.primitives [primitiveIndex];

            if (!primitive.instanced) {

                const positions = primitive.positions.slice();

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.transformPoint4(primitive.matrix, tempVec4a, tempVec4b);

                    positions[j] = tempVec4b[0];
                    positions[j + 1] = tempVec4b[1];
                    positions[j + 2] = tempVec4b[2];
                }

                primitive.positions = positions;
            }

            // Compress normals

            const modelNormalMatrix = (primitive.matrix) ? math.inverseMat4(math.transposeMat4(primitive.matrix, tempMat4b), tempMat4) : math.identityMat4(tempMat4);
            const encodedNormals = new Int8Array(primitive.normals.length);

            geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, primitive.normals, primitive.normals.length, encodedNormals, 0);

            primitive.normals = encodedNormals;
        }
    }
}

module.exports = Model;