/**
 *
 */
class Entity {

    /**
     *
     * @param entityId
     * @param entityIndex
     * @param matrix
     * @param primitiveInstances
     * @param instancing
     * @param aabb
     */
    constructor(entityId, entityIndex, matrix, primitiveInstances,  aabb, instancing) {

        /**
         * Unique ID of this entity.
         */
        this.entityId = entityId;

        /**
         * Index of this Entity in Model#entitiesList;
         */
        this.entityIndex = entityIndex;

        /**
         *
         */
        this.matrix = matrix;

        /**
         *
         */
        this.primitiveInstances = primitiveInstances;

        /**
         *
         */
        this.aabb = aabb;

        /**
         *
         */
        this.instancing = instancing;
    }
}

module.exports = Entity;