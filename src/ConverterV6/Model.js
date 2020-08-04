const math = require('../lib/math');

const PrimitiveInstance = require('./PrimitiveInstance');
const Primitive = require('./Primitive');
const Entity = require('./Entity');
const Tile = require('./Tile');

const geometryCompression = require('../lib/geometryCompression');
const buildEdgeIndices = require('../lib/buildEdgeIndices');

const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempAABB3 = new Float32Array(6);

const KD_TREE_MAX_DEPTH = 5; // Increase if greater precision needed
const kdTreeDimLength = new Float32Array(3);

/**
 * Intermediate data structure from which {@link createXKTFromModel} creates an XKT array buffer.
 */
class Model {

    constructor() {

        /**
         *
         * @type {*|Number[]}
         */
        this.instancedPrimitivesDecodeMatrix = math.mat4();

        /**
         * Primitives within this model, mapped to their IDs.
         *
         * Created by {@link createPrimitive}.
         */
        this.primitives = {};

        /**
         * Primitives within this model, in the order they were created.
         *
         * Created by {@link createPrimitive}.
         */
        this.primitivesList = [];

        /**
         * Primitive instances within this model, in the order they were created.
         *
         * Created by {@link createEntity}.
         */
        this.primitiveInstancesList = [];

        /**
         * Entities within this model, mapped to their IDs.
         *
         * Created by {@link createEntity}.
         */
        this.entities = {};

        /**
         * Entities within this model, in the order they were created.
         *
         * Created by {@link createEntity}.
         */
        this.entitiesList = [];

        /**
         * Tiles within this model.
         *
         * Created by {@link createTiles}.
         */
        this.tilesList = [];
    }

    /**
     * Creates a {@link Primitive} within this model.
     *
     * Called by {@link createModelFromGLTF}.
     *
     * A primitive is referenced by one or more entities. We call a primitive that's referenced by multiple entities
     * an "instanced" primitive.
     *
     * For an instanced primitive, ````createPrimitive()```` will ignore the modeling matrix. For a non-instanced
     * primitive, ````createPrimitive()```` will immediately transform its positions by the modeling matrix.
     *
     * @param {Number|String} primitiveId Unique ID for the primitive.
     * @param {Boolean} instanced True if the primitive is instanced, ie. owned by more than one entity.
     * @param {Number[]} modelingMatrix If the primitive is instanced, then ````createPrimitive()```` will transform the
     * primitive's positions by this modeling matrix. This argument is ignored when the primitive is owned by multiple entities.
     * @param {Number[]} color RGB color for the primitive, with each color component in range [0..1].
     * @param {Number} opacity Opacity factor for the primitive, in range [0..1].
     * @param {Number[]} positions Floating-point vertex positions for the primitive.
     * @param {Number[]}normals Floating-point vertex normals for the primitive.
     * @param {Number[]}indices Triangle mesh indices for the primitive.
     */
    createPrimitive(primitiveId, instanced, modelingMatrix, color, opacity, positions, normals, indices) {

        const edgeIndices = buildEdgeIndices(positions, indices, null, 10);

        if (!instanced) {

            // Bake non-instanced primitive's positions into World-space

            for (let i = 0, len = positions.length; i < len; i += 3) {
                tempVec4a[0] = positions[i + 0];
                tempVec4a[1] = positions[i + 1];
                tempVec4a[2] = positions[i + 2];
                math.transformPoint4(modelingMatrix, tempVec4a, tempVec4b);
                positions[i + 0] = tempVec4b[0];
                positions[i + 1] = tempVec4b[1];
                positions[i + 2] = tempVec4b[2];
            }
        }

        // Oct-encode normals, in World-space if not instanced, otherwise in Model-space

        const modelNormalMatrix = math.inverseMat4(math.transposeMat4(modelingMatrix, tempMat4b), tempMat4);
        const compressedNormals = new Int8Array(normals.length);

        geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, normals, normals.length, compressedNormals, 0);

        const primitiveIndex = this.primitivesList.length;

        const primitive = new Primitive(primitiveId, primitiveIndex, color, opacity, instanced, positions, compressedNormals, indices, edgeIndices);

        this.primitives[primitiveId] = primitive;
        this.primitivesList.push(primitive);
    }

    /**
     * Creates an {@link Entity} within this model.
     *
     * Called by {@link createModelFromGLTF}.
     *
     * An entity is an object that is comprised of one or more primitives.
     *
     * An entity may either share all of its primitives with other entities, or exclusively own all of its
     * primitives.
     *
     * When an entity shares its primitives, the given modeling matrix will transform the primitives for the
     * entity.
     *
     * This method ignores the ````modelingMatrix```` when the entity exclusively owns the given primitives, ie. when the
     * primitives are not "instanced". This is because ````createPrimitive()```` will have already transformed those
     * instanced primitives' positions, using the ````modelingMatrix```` given to that method.
     *
     * @param entityId unique ID for the entity.
     * @param modelingMatrix Modeling matrix for the entity.
     * @param primitiveIds IDs of primitives owned by the entity.
     * @param instancing True if the entity shares its primitives with any other entities.
     */
    createEntity(entityId, modelingMatrix, primitiveIds, instancing) {

        const primitiveInstances = [];

        const entityAABB = math.AABB3();

        math.collapseAABB3(entityAABB);

        for (let primitiveId in primitiveIds) {

            const primitive = this.primitives[primitiveId];

            if (!primitive) {
                console.error("primitive not found: " + primitiveId);
                continue;
            }

            // Initialize AABB

            if (instancing) {

                const positions = primitive.positions;

                for (let i = 0, len = positions.length; i < len; i += 3) {

                    tempVec4a[0] = positions[i];
                    tempVec4a[1] = positions[i + 1];
                    tempVec4a[2] = positions[i + 2];

                    math.transformPoint4(modelingMatrix, tempVec4a, tempVec4b);

                    math.expandAABB3Point3(entityAABB, tempVec4b);
                }

            } else {

                const positions = primitive.positions;

                for (let i = 0, len = positions.length; i < len; i += 3) {

                    tempVec4a[0] = positions[i];
                    tempVec4a[1] = positions[i + 1];
                    tempVec4a[2] = positions[i + 2];

                    math.expandAABB3Point3(entityAABB, tempVec4a);
                }
            }

            const primitiveInstanceIndex = this.primitiveInstancesList.length;

            const primitiveInstance = new PrimitiveInstance(primitiveInstanceIndex, primitive);

            primitiveInstances.push(primitiveInstance);

            this.primitiveInstancesList.push(primitiveInstance);
        }

        const entityIndex = this.entitiesList.length;

        const entity = new Entity(entityId, entityIndex, modelingMatrix, primitiveInstances, entityAABB, instancing);

        for (let i = 0, len = primitiveInstances.length; i < len; i++) {
            const primitiveInstance = primitiveInstances[i];
            primitiveInstance.entity = entity;
        }

        this.entities[entityId] = entity;
        this.entitiesList.push(entity);
    }

    /**
     * Creates tiles within this model.
     *
     * Called by {@link createModelFromGLTF}.
     *
     */
    createTiles() {

        const rootKDNode = this._createKDTree(); // FIXME: is killing Primitive#positions

        this._createTilesFromKDTree(rootKDNode);
    }

    _createKDTree() {

        const aabb = math.collapseAABB3();

        for (let entityId in this.entities) {
            const entity = this.entities[entityId];
            math.expandAABB3(aabb, entity.aabb);
        }

        const rootKDNode = {
            aabb: aabb
        };

        for (let entityId in this.entities) {
            const entity = this.entities[entityId];
            const depth = 0;
            const maxKDNodeDepth = KD_TREE_MAX_DEPTH;
            this._insertEntityIntoKDTree(rootKDNode, entity, depth + 1, maxKDNodeDepth);
        }

        return rootKDNode;
    }

    _insertEntityIntoKDTree(kdNode, entity, depth, maxKDTreeDepth) {

        const entityAABB = entity.aabb;

        if (depth >= maxKDTreeDepth) {
            kdNode.entities = kdNode.entities || [];
            kdNode.entities.push(entity);
            math.expandAABB3(kdNode.aabb, entityAABB);
            entity.kdNode = kdNode;
            return;
        }

        if (kdNode.left) {
            if (math.containsAABB3(kdNode.left.aabb, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.left, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (kdNode.right) {
            if (math.containsAABB3(kdNode.right.aabb, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.right, entity, depth + 1, maxKDTreeDepth);
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
            if (math.containsAABB3(aabbLeft, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.left, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (!kdNode.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            kdNode.right = {
                aabb: aabbRight
            };
            if (math.containsAABB3(aabbRight, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.right, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        kdNode.entities = kdNode.entities || [];
        kdNode.entities.push(entity);

        math.expandAABB3(kdNode.aabb, entityAABB);
    }

    _createTilesFromKDTree(rootKDNode) {
        this._createTilesFromKDNode(rootKDNode);
    }

    _createTilesFromKDNode(kdNode) {
        if (kdNode.entities && kdNode.entities.length > 0) {
            this._createTileFromEntities(kdNode.entities)
        }
        if (kdNode.left) {
            this._createTilesFromKDNode(kdNode.left);
        }
        if (kdNode.right) {
            this._createTilesFromKDNode(kdNode.right);
        }
    }

    /**
     * Creates a tile from the given entities.
     *
     * For each non-instanced primitive, this method centers the primitive's positions to make them relative to the
     * tile's center, then quantizes the positions to unsigned 16-bit integers, relative to the tile's boundary.
     *
     * @param entities
     * @private
     */
    _createTileFromEntities(entities) {

        const tileAABB = math.AABB3();
        const tileDecodeMatrix = math.mat4();

        math.collapseAABB3(tileAABB);

        for (let i = 0; i < entities.length; i++) {
            const entity = entities [i];
            const entityAABB = entity.aabb;
            math.expandAABB3(tileAABB, entityAABB);
        }

        // Make the positions of all primitives belonging solely to the entities
        // within this tile relative to the tile's center

        const tileCenter = math.getAABB3Center(tileAABB);

        for (let i = 0; i < entities.length; i++) {

            const entity = entities [i];

            const primitiveInstances = entity.primitiveInstances;

            for (let j = 0, lenj = primitiveInstances.length; j < lenj; j++) {

                const primitiveInstance = primitiveInstances[j];
                const primitive = primitiveInstance.primitive;

                if (!primitive.instanced) {

                    const positions = primitive.positions;

                    if (!positions) {
                        debugger;
                    }

                    // Center positions relative to tile center

                    for (let k = 0, lenk = positions.length; k < lenk; k += 3) {

                        positions[k + 0] -= tileCenter[0];
                        positions[k + 1] -= tileCenter[1];
                        positions[k + 2] -= tileCenter[2];
                    }

                    // Quantize positions relative to tile boundary

                    const quantizedPositions = new Uint16Array(positions.length);

                    geometryCompression.quantizePositions(positions, positions.length, tileAABB, quantizedPositions);

                    primitive.positions = quantizedPositions;
                }
            }
        }

        const tile = new Tile(tileAABB, tileDecodeMatrix, entities);

        this.tilesList.push(tile);
    }
}

module.exports = Model;