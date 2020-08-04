/**
 * Represents a primitive instance that's owned by an entity.
 */
class PrimitiveInstance {

    /**
     *
     * @param primitiveInstanceIndex
     * @param entity
     * @param primitive
     */
    constructor(primitiveInstanceIndex,  primitive) {

        /**
         * Index of this PrimitiveInstance in Model#primitiveInstancesList;
         */
        this.primitiveInstanceIndex = primitiveInstanceIndex;

        /*
        The primitive that is instanced.
         */
        this.primitive = primitive;

        /**
         * The entity that owns the primitive instance.
         */
        this.entity = null; // Set after instantiation
    }
}

module.exports = PrimitiveInstance;