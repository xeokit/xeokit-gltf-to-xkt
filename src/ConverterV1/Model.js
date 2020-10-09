const math = require('../lib/math');
const geometryCompression = require('../lib/geometryCompression');

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);

class Model {

    constructor() {
        this.meshes = [];
        this.entities = [];
        this.positionsDecodeMatrix = math.mat4();
    }

    createEntity(params) {
        this.entities.push(params);
    }

    createMesh(params) {
        this.meshes.push(params);
    }

    finalize() {

        // Transform model positions into World-space
        // Build model AABB
        // Quantize model positions using model AABB
        // Transform model normals into World-space
        // Oct-encode model normals
        // Create positions dequantization matrix from model AABB

        const aabb = math.collapseAABB3();

        for (let i = 0, len = this.meshes.length; i < len; i++) {

            const mesh = this.meshes [i];
            const matrix = mesh.matrix;
            const positions = mesh.positions.slice();

            for (let j = 0, len2 = positions.length; j < len2; j += 3) {
                tempVec4a[0] = positions[j];
                tempVec4a[1] = positions[j + 1];
                tempVec4a[2] = positions[j + 2];
                math.transformPoint4(matrix, tempVec4a, tempVec4b);
                math.expandAABB3Point3(aabb, tempVec4b);
                positions[j] = tempVec4b[0];
                positions[j + 1] = tempVec4b[1];
                positions[j + 2] = tempVec4b[2];
            }

            mesh.positions = positions;
        }

        for (let i = 0, len = this.meshes.length; i < len; i++) {

            const mesh = this.meshes [i];

            const quantizedPositions = new Uint16Array(mesh.positions.length);
            geometryCompression.quantizePositions(mesh.positions, mesh.positions.length, aabb, quantizedPositions);
            mesh.positions = quantizedPositions;


            const modelNormalMatrix = (mesh.matrix) ? math.inverseMat4(math.transposeMat4(mesh.matrix, tempMat4b), tempMat4) : math.identityMat4(tempMat4);
            const encodedNormals = new Int8Array(mesh.normals.length);
            geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, mesh.normals, mesh.normals.length, encodedNormals, 0);
            mesh.normals = encodedNormals;
        }

        geometryCompression.createPositionsDecodeMatrix(aabb, this.positionsDecodeMatrix);
    }
}

module.exports = Model;