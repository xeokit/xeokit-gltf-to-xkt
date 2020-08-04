/**
 * A 3D region that contains Entitys.
 */
class Tile {

    constructor(aabb, decodeMatrix, entities) {

        /**
         * Axis-aligned World-space bounding box that encloses the Entity's within this Tile.
         */
        this.aabb = aabb;

        /**
         * Positions dequantization matrix to decompress the shared Primitives belonging to the Entity's within this Tile.
         */
        this.decodeMatrix = decodeMatrix;

        /**
         * The Entity's within this Tile.
         */
        this.entities = entities;
    }
}

module.exports = Tile;