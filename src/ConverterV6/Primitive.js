/**
 * An element of geometry that belongs to one or more Entitys.
 */
class Primitive {

    /**
     *
     * @param primitiveId
     * @param primitiveIndex
     * @param color
     * @param opacity
     * @param instanced
     * @param positions
     * @param normals
     * @param indices
     * @param edgeIndices
     */
    constructor(primitiveId, primitiveIndex, color, opacity, instanced, positions, normals, indices, edgeIndices) {

        /**
         * Unique ID of this Primitive.
         *
         * Find the primitive by this ID in Model#primitives.
         */
        this.primitiveId = primitiveId;

        /**
         * Index of this Primitive in Model#primitivesList;
         */
        this.primitiveIndex = primitiveIndex;

        /**
         * RGB color of this Primitive.
         */
        this.color = color;

        /**
         * Opacity of this Primitive;
         */
        this.opacity = opacity;

        /**
         * True if this Primitive owned by more than one Entity.
         */
        this.instanced = instanced;

        /**
         * Flat array of 3D positions of this Primitive's triangles and edges. In Model-space if #instanced is true, else in World-space.
         */
        this.positions = positions;

        /**
         * Flat array of normals encoded as unsigned 8-bit integers. In Model-space if #instanced is true, else in World-space.
         */
        this.normals = normals;

        /**
         * Indices of the positions that comprise this Primitive's triangles.
         */
        this.indices = indices;

        /**
         * Indices of the positions that comprise this Primitive's edges.
         */
        this.edgeIndices = edgeIndices;

    }
}

module.exports = Primitive;