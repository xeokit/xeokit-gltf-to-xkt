const math = require('./math');
const geometryCompression = require('./geometryCompression');

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);

const KD_TREE_MAX_DEPTH = 4;

const kdTreeDimLength = new Float32Array();

/**
 * Contains the output of {@link glTFToModel}.
 */
class Model {

    constructor() {

        this.decodeMatrices = [];
        this.primitives = [];
        this.entities = [];

        // Used by _startDecodeMat(), _addPrimitiveToDecodeMat() and _finalizeDecodeMat()

        this._tileAABB = math.AABB3();
        this._tileDecodeMatrix = math.mat4();
        this._tilePrimitives = [];
        this._numTilePrimitives = 0;
    }

    createPrimitive(params) {
        this.primitives.push(params);
    }

    createEntity(params) {
        this.entities.push(params);
    }

    finalize() {

        const batchedPrimitives = [];
        const instancedPrimitives = [];

        // Transform positions of each primitive that is not reused (ie. batched)
        // Calculate AABB for each primitive
        // Compress normals of all primitives

        for (let i = 0, len = this.primitives.length; i < len; i++) {

            const primitive = this.primitives [i];
            const batched = (!primitive.instanced);

            primitive.aabb = math.collapseAABB3();
            const matrix = primitive.matrix;

            if (batched) { // Non reused primitives

                const positions = primitive.positions.slice();

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.transformPoint4(matrix, tempVec4a, tempVec4b);

                    math.expandAABB3Point3(primitive.aabb, tempVec4b);

                    positions[j] = tempVec4b[0];
                    positions[j + 1] = tempVec4b[1];
                    positions[j + 2] = tempVec4b[2];
                }

                primitive.positions = positions;

                batchedPrimitives.push(primitive);

            } else { // Instanced primitive

                const positions = primitive.positions;

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.expandAABB3Point3(primitive.aabb, tempVec4a);
                }

                instancedPrimitives.push(primitive);
            }

            // Compress normals

            //-------------------------------------------------------
            // TODO: Normals for non-shared primitives in World space?
            // Normals for shared primitives in model space?
            //-------------------------------------------------------

            const modelNormalMatrix = (primitive.matrix) ? math.inverseMat4(math.transposeMat4(primitive.matrix, tempMat4b), tempMat4) : math.identityMat4(tempMat4);
            const encodedNormals = new Int8Array(primitive.normals.length);

            geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, primitive.normals, primitive.normals.length, encodedNormals, 0);

            primitive.normals = encodedNormals;
        }


        // this._startDecodeMat();
        // for (let i = 0, len = instancedPrimitives.length; i < len; i++) {
        //     const primitive = instancedPrimitives[i];
        //     this._addPrimitiveToDecodeMat(primitive)
        // }
        // this._finalizeDecodeMat();

        // this._startDecodeMat();
        // for (let i = 0, len = batchedPrimitives.length; i < len; i++) {
        //     const primitive = batchedPrimitives[i];
        //     this._addPrimitiveToDecodeMat(primitive);
        // }
        // this._finalizeDecodeMat();
        //
        // this._startDecodeMat();
        // for (let i = 0, len = instancedPrimitives.length; i < len; i++) {
        //     const primitive = instancedPrimitives[i];
        //     this._addPrimitiveToDecodeMat(primitive)
        // }
        // this._finalizeDecodeMat();
        //

        this._buildDecodeMatrices(batchedPrimitives);
    }


    _buildDecodeMatrices(primitives) {
        const kdTree = this._createKDTree(primitives);
        this._createDecodeMatsFromKDTree(kdTree);
    }

    _createKDTree(primitives) {
        const aabb = math.collapseAABB3();
        for (let i = 0, len = primitives.length; i < len; i++) {
            const primitive = primitives[i];
            math.expandAABB3(aabb, primitive.aabb);
        }
        const root = {
            aabb: aabb
        };
        for (let i = 0, len = primitives.length; i < len; i++) {
            const primitive = primitives[i];
            const depth = 0;
            this._insertPrimitiveIntoKDTree(root, primitive, depth + 1);
        }
        return root;
    }

    _insertPrimitiveIntoKDTree(node, primitive, depth) {

        const primitiveAABB = primitive.aabb;

        if (depth >= KD_TREE_MAX_DEPTH) {
            node.primitives = node.primitives || [];
            node.primitives.push(primitive);
            math.expandAABB3(node.aabb, primitiveAABB);
            return;
        }

        if (node.left) {
            if (math.containsAABB3(node.left.aabb, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(node.left, primitive, depth + 1);
                return;
            }
        }

        if (node.right) {
            if (math.containsAABB3(node.right.aabb, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(node.right, primitive, depth + 1);
                return;
            }
        }

        const nodeAABB = node.aabb;
        kdTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        kdTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        kdTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];

        let dim = 0;

        if (kdTreeDimLength[1] > kdTreeDimLength[dim]) {
            dim = 1;
        }

        if (kdTreeDimLength[2] > kdTreeDimLength[dim]) {
            dim = 2;
        }

        if (!node.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.left = {
                aabb: aabbLeft
            };
            if (math.containsAABB3(aabbLeft, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(node.left, primitive, depth + 1);
                return;
            }
        }

        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                aabb: aabbRight
            };
            if (math.containsAABB3(aabbRight, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(node.right, primitive, depth + 1);
                return;
            }
        }

        node.primitives = node.primitives || [];
        node.primitives.push(primitive);
        math.expandAABB3(node.aabb, primitiveAABB);
    }

    _createDecodeMatsFromKDTree(kdNode) {
        if (kdNode.primitives && kdNode.primitives.length > 0) {
            this._startDecodeMat();
            const primitives = kdNode.primitives;
            for (let i = 0, len = primitives.length; i < len; i++) {
                const primitive = primitives[i];
                this._addPrimitiveToDecodeMat(primitive)
            }
            this._finalizeDecodeMat();
        }
        if (kdNode.left) {
            this._createDecodeMatsFromKDTree(kdNode.left);
        }
        if (kdNode.right) {
            this._createDecodeMatsFromKDTree(kdNode.right);
        }
    }

    _startDecodeMat() {
        this._numTilePrimitives = 0;
    }

    _addPrimitiveToDecodeMat(primitive) {
        primitive.decodeMatrixIdx = this.decodeMatrices.length;
        this._tilePrimitives[this._numTilePrimitives++] = primitive;
    }

    _finalizeDecodeMat() {

        const tileAABB = math.collapseAABB3();

        for (let i = 0; i < this._numTilePrimitives; i++) {
            const primitive = this._tilePrimitives [i];
            const positions = primitive.positions;
            for (let j = 0, lenj = positions.length; j < lenj; j += 3) {
                tempVec4a[0] = positions[j];
                tempVec4a[1] = positions[j + 1];
                tempVec4a[2] = positions[j + 2];
                math.expandAABB3Point3(tileAABB, tempVec4a);
            }
        }

        this._tileDecodeMatrix = math.mat4();

        geometryCompression.createPositionsDecodeMatrix(tileAABB, this._tileDecodeMatrix);

        for (let i = 0; i < 16; i++) {
            this.decodeMatrices.push(this._tileDecodeMatrix[i]);
        }

        for (let i = 0; i < this._numTilePrimitives; i++) {
            const primitive = this._tilePrimitives [i];
            const quantizedPositions = new Uint16Array(primitive.positions.length);
            geometryCompression.quantizePositions(primitive.positions, primitive.positions.length, tileAABB, quantizedPositions);
            primitive.positions = quantizedPositions;
        }

    }
}

module.exports = Model;