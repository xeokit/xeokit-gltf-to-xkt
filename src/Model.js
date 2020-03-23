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
        this.meshes = [];
        this.entities = [];

        // Used by _startDecodeMat(), _addMeshToDecodeMat() and _finalizeDecodeMat()

        this._tileAABB = math.AABB3();
        this._tileDecodeMatrix = math.mat4();
        this._tileMeshes = [];
        this._numTileMeshes = 0;
    }

    createMesh(params) {
        this.meshes.push(params);
    }

    createEntity(params) {
        this.entities.push(params);
    }

    finalize() {

        const batchedMeshes = [];
        const instancedMeshes = [];

        // Transform positions of each mesh that is not reused (ie. batched)
        // Calculate AABB for each mesh
        // Compress normals of all meshes

        for (let i = 0, len = this.meshes.length; i < len; i++) {

            const mesh = this.meshes [i];
            const batched = (!mesh.instanced);

            mesh.aabb = math.collapseAABB3();
            const matrix = mesh.matrix;

            if (batched) { // Non reused meshes

                const positions = mesh.positions.slice();

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.transformPoint4(matrix, tempVec4a, tempVec4b);

                    math.expandAABB3Point3(mesh.aabb, tempVec4b);

                    positions[j] = tempVec4b[0];
                    positions[j + 1] = tempVec4b[1];
                    positions[j + 2] = tempVec4b[2];
                }

                mesh.positions = positions;

                batchedMeshes.push(mesh);

            } else { // Instanced mesh

                const positions = mesh.positions;

                for (let j = 0, lenj = positions.length; j < lenj; j += 3) {

                    tempVec4a[0] = positions[j];
                    tempVec4a[1] = positions[j + 1];
                    tempVec4a[2] = positions[j + 2];

                    math.expandAABB3Point3(mesh.aabb, tempVec4a);
                }

                instancedMeshes.push(mesh);
            }

            // Compress normals

            //-------------------------------------------------------
            // TODO: Normals for non-shared meshes in World space?
            // Normals for shared meshes in model space?
            //-------------------------------------------------------

            const modelNormalMatrix = (mesh.matrix) ? math.inverseMat4(math.transposeMat4(mesh.matrix, tempMat4b), tempMat4) : math.identityMat4(tempMat4);
            const encodedNormals = new Int8Array(mesh.normals.length);

            geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, mesh.normals, mesh.normals.length, encodedNormals, 0);

            mesh.normals = encodedNormals;
        }


        // this._startDecodeMat();
        // for (let i = 0, len = instancedMeshes.length; i < len; i++) {
        //     const mesh = instancedMeshes[i];
        //     this._addMeshToDecodeMat(mesh)
        // }
        // this._finalizeDecodeMat();

        // this._startDecodeMat();
        // for (let i = 0, len = batchedMeshes.length; i < len; i++) {
        //     const mesh = batchedMeshes[i];
        //     this._addMeshToDecodeMat(mesh);
        // }
        // this._finalizeDecodeMat();
        //
        // this._startDecodeMat();
        // for (let i = 0, len = instancedMeshes.length; i < len; i++) {
        //     const mesh = instancedMeshes[i];
        //     this._addMeshToDecodeMat(mesh)
        // }
        // this._finalizeDecodeMat();
        //

        this._buildDecodeMatrices(batchedMeshes);
    }


    _buildDecodeMatrices(meshes) {
        const kdTree = this._createKDTree(meshes);
        this._createDecodeMatsFromKDTree(kdTree);
    }

    _createKDTree(meshes) {
        const aabb = math.collapseAABB3();
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            math.expandAABB3(aabb, mesh.aabb);
        }
        const root = {
            aabb: aabb
        };
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            const depth = 0;
            this._insertMeshIntoKDTree(root, mesh, depth + 1);
        }
        return root;
    }

    _insertMeshIntoKDTree(node, mesh, depth) {

        const meshAABB = mesh.aabb;

        if (depth >= KD_TREE_MAX_DEPTH) {
            node.meshes = node.meshes || [];
            node.meshes.push(mesh);
            math.expandAABB3(node.aabb, meshAABB);
            return;
        }

        if (node.left) {
            if (math.containsAABB3(node.left.aabb, meshAABB)) {
                this._insertMeshIntoKDTree(node.left, mesh, depth + 1);
                return;
            }
        }

        if (node.right) {
            if (math.containsAABB3(node.right.aabb, meshAABB)) {
                this._insertMeshIntoKDTree(node.right, mesh, depth + 1);
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
            if (math.containsAABB3(aabbLeft, meshAABB)) {
                this._insertMeshIntoKDTree(node.left, mesh, depth + 1);
                return;
            }
        }

        if (!node.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            node.right = {
                aabb: aabbRight
            };
            if (math.containsAABB3(aabbRight, meshAABB)) {
                this._insertMeshIntoKDTree(node.right, mesh, depth + 1);
                return;
            }
        }

        node.meshes = node.meshes || [];
        node.meshes.push(mesh);
        math.expandAABB3(node.aabb, meshAABB);
    }

    _createDecodeMatsFromKDTree(kdNode) {
        if (kdNode.meshes && kdNode.meshes.length > 0) {
            this._startDecodeMat();
            const meshes = kdNode.meshes;
            for (let i = 0, len = meshes.length; i < len; i++) {
                const mesh = meshes[i];
                this._addMeshToDecodeMat(mesh)
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
        this._numTileMeshes = 0;
    }

    _addMeshToDecodeMat(mesh) {
        mesh.decodeMatrixIdx = this.decodeMatrices.length;
        this._tileMeshes[this._numTileMeshes++] = mesh;
    }

    _finalizeDecodeMat() {

        const tileAABB = math.collapseAABB3();

        for (let i = 0; i < this._numTileMeshes; i++) {
            const mesh = this._tileMeshes [i];
            const positions = mesh.positions;
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

        for (let i = 0; i < this._numTileMeshes; i++) {
            const mesh = this._tileMeshes [i];
            const quantizedPositions = new Uint16Array(mesh.positions.length);
            geometryCompression.quantizePositions(mesh.positions, mesh.positions.length, tileAABB, quantizedPositions);
            mesh.positions = quantizedPositions;
        }

    }
}

module.exports = Model;