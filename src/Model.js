const math = require('./math');
const geometryCompression = require('./geometryCompression');
const fs = require('fs');

const USE_KD_TREE = false; // Set true to partition the model in separately-quantized regions
const LOG_KD_TREE = false; // Set true to write a JSON file of the k-d tree structure to "./kdtree.json" for debugging
const KD_TREE_MAX_DEPTH = 4; // Increase if greater precision needed

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempAABB3 = new Float32Array(6);

const kdTreeDimLength = new Float32Array(3);

/**
 * Contains the output of {@link glTFToModel}.
 */
class Model {

    constructor() {
        this.primitives = [];
        this.entities = [];
        this.decodeMatrices = [];
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

        // 1. On each instanced primitive: create Model-space AABB
        // 2. On each non-instanced primitive: bake positions in World-space and create World-space AABB
        // 3. On all primitives: compress normals
        // 4. Create decode matrices and connect primitives to them

        const batchedPrimitives = [];
        const instancedPrimitives = [];

        const batchedAABB = math.collapseAABB3(); // This is just used for logging the boundary

        for (let primitiveIndex = 0, numPrimitives = this.primitives.length; primitiveIndex < numPrimitives; primitiveIndex++) {

            const primitive = this.primitives [primitiveIndex];

            primitive.aabb = math.collapseAABB3();

            if (primitive.instanced) {

                const positions = primitive.positions;

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.expandAABB3Point3(primitive.aabb, tempVec4a);
                }

                instancedPrimitives.push(primitive);

            } else { // Batched primitive

                const positions = primitive.positions.slice();

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.transformPoint4(primitive.matrix, tempVec4a, tempVec4b);

                    math.expandAABB3Point3(primitive.aabb, tempVec4b);
                    math.expandAABB3Point3(batchedAABB, tempVec4b);

                    positions[j] = tempVec4b[0];
                    positions[j + 1] = tempVec4b[1];
                    positions[j + 2] = tempVec4b[2];
                }

                primitive.positions = positions;

                batchedPrimitives.push(primitive);
            }

            // Compress normals

            const modelNormalMatrix = (primitive.matrix) ? math.inverseMat4(math.transposeMat4(primitive.matrix, tempMat4b), tempMat4) : math.identityMat4(tempMat4);
            const encodedNormals = new Int8Array(primitive.normals.length);

            geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, primitive.normals, primitive.normals.length, encodedNormals, 0);

            primitive.normals = encodedNormals;
        }

        // Log boundary and center

        console.log("Model boundary = [xmin: " + batchedAABB[0] + ", ymin = " + batchedAABB[1] + ", zmin: " + batchedAABB[2] + ", xmax: " + batchedAABB[3] + ", ymax: " + batchedAABB[4] + ", zmax: " + batchedAABB[5] + "]");
        console.log("Model center = [x: " + (batchedAABB[0] + batchedAABB[3]) / 2.0 + ", y: " + (batchedAABB[1] + batchedAABB[4]) / 2.0 + ", z: " + (batchedAABB[2] + batchedAABB[4]) / 2.0 + "]");

        // Create a single decode matrix for all instanced primitives

        this._createDecodeMatrixFromPrimitives(instancedPrimitives);

        // If partitioning enabled, create separate decode matrices for batched primitives partitioned by k-d tree,
        // otherwise just create a single decode matrix for all batched primitives

        if (USE_KD_TREE) {

            const kdTree = this._createKDTree(batchedPrimitives, KD_TREE_MAX_DEPTH);

            this._createDecodeMatricesFromKDTree(kdTree);

            if (LOG_KD_TREE) {
                writeKDTreeToFile("./kdtree.json", kdTree)
            }

        } else {
            this._createDecodeMatrixFromPrimitives(batchedPrimitives);
        }
    }

    /**
     * Builds a k-d tree that spatially organizes the given primitives into partitions.
     *
     * @param primitives
     * @param maxKDTreeDepth
     * @returns {*}
     * @private
     */
    _createKDTree(primitives, maxKDTreeDepth) {
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
            this._insertPrimitiveIntoKDTree(root, primitive, depth + 1, maxKDTreeDepth);
        }
        return root;
    }

    /**
     * Inserts a primitive into a k-d tree.
     *
     * @param kdNode
     * @param primitive
     * @param depth
     * @param maxKDTreeDepth
     * @private
     */
    _insertPrimitiveIntoKDTree(kdNode, primitive, depth, maxKDTreeDepth) {

        const primitiveAABB = primitive.aabb;

        if (depth >= maxKDTreeDepth) {
            kdNode.primitives = kdNode.primitives || [];
            kdNode.primitives.push(primitive);
            math.expandAABB3(kdNode.aabb, primitiveAABB);
            return;
        }

        if (kdNode.left) {
            if (math.containsAABB3(kdNode.left.aabb, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(kdNode.left, primitive, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (kdNode.right) {
            if (math.containsAABB3(kdNode.right.aabb, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(kdNode.right, primitive, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        const nodeAABB = kdNode.aabb;

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

        if (!kdNode.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            kdNode.left = {
                aabb: aabbLeft
            };
            if (math.containsAABB3(aabbLeft, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(kdNode.left, primitive, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (!kdNode.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            kdNode.right = {
                aabb: aabbRight
            };
            if (math.containsAABB3(aabbRight, primitiveAABB)) {
                this._insertPrimitiveIntoKDTree(kdNode.right, primitive, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        kdNode.primitives = kdNode.primitives || [];
        kdNode.primitives.push(primitive);
        math.expandAABB3(kdNode.aabb, primitiveAABB);
    }

    /**
     * Creates positions decode matrices for the primitives in the given k-d tree.
     *
     * @param kdNode
     * @private
     */
    _createDecodeMatricesFromKDTree(kdNode) {
        if (kdNode.primitives && kdNode.primitives.length > 0) {
            this._createDecodeMatrixFromPrimitives(kdNode.primitives)
        }
        if (kdNode.left) {
            this._createDecodeMatricesFromKDTree(kdNode.left);
        }
        if (kdNode.right) {
            this._createDecodeMatricesFromKDTree(kdNode.right);
        }
    }

    /**
     * Creates a positions decode matrix for the given primitives.
     *
     * @param primitives
     * @private
     */
    _createDecodeMatrixFromPrimitives(primitives) {
        math.collapseAABB3(tempAABB3);
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives [i];
            const positions = primitive.positions;
            for (let j = 0, lenj = positions.length; j < lenj; j += 3) {
                tempVec4a[0] = positions[j];
                tempVec4a[1] = positions[j + 1];
                tempVec4a[2] = positions[j + 2];
                math.expandAABB3Point3(tempAABB3, tempVec4a);
            }
        }
        geometryCompression.createPositionsDecodeMatrix(tempAABB3, tempMat4);
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives [i];
            const quantizedPositions = new Uint16Array(primitive.positions.length);
            geometryCompression.quantizePositions(primitive.positions, primitive.positions.length, tempAABB3, quantizedPositions);
            primitive.positions = quantizedPositions;
            primitive.decodeMatrixIdx = this.decodeMatrices.length;
        }
        for (let i = 0; i < 16; i++) {
            this.decodeMatrices.push(tempMat4[i]);
        }
    }
}

/**
 * Writes a k-d tree to a JSON file for debugging.
 *
 * @param filePath
 * @param kdNode
 * @returns {Promise<any>}
 */
function writeKDTreeToFile(filePath, kdNode) {
    const json = createKDTreeJSON(kdNode);
    return new Promise((resolve, reject) => {
        const kdTreeJSON = createKDTreeJSON(kdNode);
        fs.writeFile(filePath, JSON.stringify(kdTreeJSON), "utf8", (error) => {
            if (error !== null) {
                console.error(`Unable to write to file at path: ${kdTreePath}`);
                reject(error);
                return;
            }
            resolve();
        });
    });
}

/**
 * Serializes a k-d tree to JSON.
 *
 * @param kdNode
 * @returns {*}
 */
function createKDTreeJSON(kdNode) {
    const json = {
        aabb: Array.prototype.slice.call(kdNode.aabb)
    };
    if (kdNode.left) {
        json.left = createKDTreeJSON(kdNode.left);
    }
    if (kdNode.right) {
        json.right = createKDTreeJSON(kdNode.right);
    }
    return json;
}

module.exports = Model;