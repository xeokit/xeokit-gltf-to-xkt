const pako = require('pako');

const XKT_VERSION = 6; // XKT format version

/**
 * Serializes a {@link Model} to an {@link ArrayBuffer}.
 *
 * @param {Model} model The model.
 * @returns {ArrayBuffer} The ArrayBuffer.
 */
function createXKTFromModel(model) {

    const data = getModelData(model);

    const deflatedData = deflateData(data);

    const arrayBuffer = createArrayBuffer(deflatedData);

    return arrayBuffer;
}

function getModelData(model) {

    const primitivesList = model.primitivesList;
    const primitiveInstancesList = model.primitiveInstancesList;
    const entities = model.entities;
    const entitiesList = model.entitiesList;
    const tilesList = model.tilesList;

    const numPrimitives = primitivesList.length;
    const numPrimitiveInstances = primitiveInstancesList.length;
    const numEntities = entitiesList.length;
    let numEntityMatrices = 0;
    const numTiles = tilesList.length;

    let lenPositions = 0;
    let lenNormals = 0;
    let lenIndices = 0;
    let lenEdgeIndices = 0;
    let lenColors = 0;

    // Allocate data

    for (let primitiveIndex = 0; primitiveIndex < numPrimitives; primitiveIndex++) {

        const primitive = primitivesList [primitiveIndex];

        lenPositions += primitive.positions.length;
        lenNormals += primitive.normals.length;
        lenIndices += primitive.indices.length;
        lenEdgeIndices += primitive.edgeIndices.length;
        lenColors += 4;
    }

    for (let entityIndex = 0; entityIndex < numEntities; entityIndex++) {

        const entity = entitiesList[entityIndex];

        if (entity.instancing) {
            numEntityMatrices++;
        }
    }

    const data = {

        positions: new Uint16Array(lenPositions), // All geometry arrays
        normals: new Int8Array(lenNormals),
        indices: new Uint32Array(lenIndices),
        edgeIndices: new Uint32Array(lenEdgeIndices),

        matrices: new Float32Array(numEntityMatrices * 16), // Modeling matrices for all instanced primitives

        instancedPrimitivesDecodeMatrix: new Float32Array(16), // A single, global position-dequantization matrix for all instanced primitives

        eachPrimitivePositionsAndNormalsPortion: new Uint32Array(numPrimitives), // For each primitive, an index to its first element in data.positions and data.normals
        eachPrimitiveIndicesPortion: new Uint32Array(numPrimitives), // For each primitive, an index to its first element in data.indices
        eachPrimitiveEdgeIndicesPortion: new Uint32Array(numPrimitives), // For each primitive, an index to its first element in data.edgeIndices
        eachPrimitiveColorAndOpacity: new Uint8Array(lenColors), // For each primitive, an RGBA integer color [0..255, 0..255, 0..255, 0..255]

        primitiveInstances: new Uint32Array(numPrimitiveInstances), // For each entity, a list of indices into eachPrimitivePositionsAndNormalsPortion, eachPrimitiveIndicesPortion, eachPrimitiveEdgeIndicesPortion, eachPrimitiveDecodeMatricesPortion and eachPrimitiveColorAndOpacity

        // Entity elements in the following arrays are grouped in runs that are shared by the same tiles

        eachEntityId: [], // For each entity, an ID string
        eachEntityPrimitiveInstancesPortion: new Uint32Array(numEntities), // For each entity, the index of the the first element of primitiveInstances used by the entity
        eachEntityMatricesPortion: new Uint32Array(numEntities), // For each primitive instance, an index to its first element in data.matrices
        
        eachTileAABB: new Float32Array(numTiles * 6), // For each tile, an axis-aigned bounding box
        eachTileDecodeMatrix: new Float32Array(numTiles * 16), // For each tile, a position dequantization matrix
        eachTileEntitiesPortion: new Uint32Array(numTiles) // For each tile, the index of the the first element of eachEntityId, eachEntityPrimitiveInstancesPortion and eachEntityMatricesPortion used by the tile
    };

    let countPositions = 0;
    let countNormals = 0;
    let countIndices = 0;
    let countEdgeIndices = 0;
    let countColors = 0;

    for (let primitiveIndex = 0; primitiveIndex < numPrimitives; primitiveIndex++) {

        const primitive = primitivesList [primitiveIndex];

        data.positions.set(primitive.positions, countPositions);
        data.normals.set(primitive.normals, countNormals);
        data.indices.set(primitive.indices, countIndices);
        data.edgeIndices.set(primitive.edgeIndices, countEdgeIndices);

        data.eachPrimitivePositionsAndNormalsPortion [primitiveIndex] = countPositions;
        data.eachPrimitiveIndicesPortion [primitiveIndex] = countIndices;
        data.eachPrimitiveEdgeIndicesPortion [primitiveIndex] = countEdgeIndices;
        data.eachPrimitiveColorAndOpacity[countColors + 0] = Math.floor(primitive.color[0] * 255);
        data.eachPrimitiveColorAndOpacity[countColors + 1] = Math.floor(primitive.color[1] * 255);
        data.eachPrimitiveColorAndOpacity[countColors + 2] = Math.floor(primitive.color[2] * 255);
        data.eachPrimitiveColorAndOpacity[countColors + 3] = Math.floor(primitive.opacity * 255);

        countPositions += primitive.positions.length;
        countNormals += primitive.normals.length;
        countIndices += primitive.indices.length;
        countEdgeIndices += primitive.edgeIndices.length;
        countColors += 4;
    }

    for (let primitiveInstanceIndex = 0; primitiveInstanceIndex < numPrimitiveInstances; primitiveInstanceIndex++) {

        const primitiveInstance = primitiveInstancesList [primitiveInstanceIndex];
        const primitive = primitiveInstance.primitive;
        const primitiveIndex = primitive.primitiveIndex;

        data.primitiveInstances [primitiveInstanceIndex] = primitiveIndex;
    }

    let entityIndex = 0;
    let countEntityPrimitiveInstancesPortion = 0;
    let countEntityMatrices = 0;

    for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {

        const tile = tilesList [tileIndex];
        const tileEntities = tile.entities;
        const numTileEntities = tileEntities.length;
        const tileAABB = tile.aabb;
        const tileDecodeMatrix = tile.decodeMatrix;

        for (let j = 0; j < numTileEntities; j++) {

            const entity = tileEntities[j];
            const entityPrimitiveInstances = entity.primitiveInstances;
            const numEntityPrimitiveInstances = entityPrimitiveInstances.length;

            if (numEntityPrimitiveInstances === 0) {
                continue;
            }

            if (entity.instancing) {
                data.matrices.set(entity.matrix, countEntityMatrices * 16);
                data.eachEntityMatricesPortion [entityIndex] = countEntityMatrices;
                countEntityMatrices++;
            }

            data.eachEntityId [entityIndex] = entity.entityId;
            data.eachEntityPrimitiveInstancesPortion[entityIndex] = countEntityPrimitiveInstancesPortion;

            entityIndex++;
            countEntityPrimitiveInstancesPortion += numEntityPrimitiveInstances;
        }

        data.eachTileAABB.set(tileAABB, tileIndex * 6);
        data.eachTileDecodeMatrix.set(tileDecodeMatrix, tileIndex * 16);
    }

    return data;
}

function deflateData(data) {
    return {

        positions: pako.deflate(data.positions.buffer),
        normals: pako.deflate(data.normals.buffer),
        indices: pako.deflate(data.indices.buffer),
        edgeIndices: pako.deflate(data.edgeIndices.buffer),
        matrices: pako.deflate(data.matrices.buffer),

        instancedPrimitivesDecodeMatrix: pako.deflate(data.instancedPrimitivesDecodeMatrix.buffer),

        eachPrimitivePositionsAndNormalsPortion: pako.deflate(data.eachPrimitivePositionsAndNormalsPortion.buffer),
        eachPrimitiveIndicesPortion: pako.deflate(data.eachPrimitiveIndicesPortion.buffer),
        eachPrimitiveEdgeIndicesPortion: pako.deflate(data.eachPrimitiveEdgeIndicesPortion.buffer),
        eachPrimitiveColorAndOpacity: pako.deflate(data.eachPrimitiveColorAndOpacity.buffer),

        primitiveInstances: pako.deflate(data.primitiveInstances.buffer),

        eachEntityId: pako.deflate(JSON.stringify(data.eachEntityId).replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        })),
        eachEntityPrimitiveInstancesPortion: pako.deflate(data.eachEntityPrimitiveInstancesPortion.buffer),
        eachEntityMatricesPortion: pako.deflate(data.eachEntityMatricesPortion.buffer),
        
        eachTileAABB: pako.deflate(data.eachTileAABB.buffer),
        eachTileDecodeMatrix: pako.deflate(data.eachTileDecodeMatrix.buffer),
        eachTileEntitiesPortion: pako.deflate(data.eachTileEntitiesPortion.buffer)
    };
}

function createArrayBuffer(deflatedData) {

    return toArrayBuffer([

        deflatedData.positions,
        deflatedData.normals,
        deflatedData.indices,
        deflatedData.edgeIndices,
        deflatedData.matrices,

        deflatedData.instancedPrimitivesDecodeMatrix,

        deflatedData.eachPrimitivePositionsAndNormalsPortion,
        deflatedData.eachPrimitiveIndicesPortion,
        deflatedData.eachPrimitiveEdgeIndicesPortion,
        deflatedData.eachPrimitiveColorAndOpacity,

        deflatedData.primitiveInstances,

        deflatedData.eachEntityId,
        deflatedData.eachEntityPrimitiveInstancesPortion,
        deflatedData.eachEntityMatricesPortion,

        deflatedData.eachTileAABB,
        deflatedData.eachTileDecodeMatrix,
        deflatedData.eachTileEntitiesPortion
    ]);
}

function toArrayBuffer(elements) {
    const indexData = new Uint32Array(elements.length + 2);
    indexData[0] = XKT_VERSION;
    indexData [1] = elements.length;  // Stored Data 1.1: number of stored elements
    let dataLen = 0;    // Stored Data 1.2: length of stored elements
    for (let i = 0, len = elements.length; i < len; i++) {
        console.log(i);
        const element = elements[i];
        const elementsize = element.length;
        indexData[i + 2] = elementsize;
        dataLen += elementsize;
    }
    const indexBuf = new Uint8Array(indexData.buffer);
    const dataArray = new Uint8Array(indexBuf.length + dataLen);
    dataArray.set(indexBuf);
    var offset = indexBuf.length;
    for (let i = 0, len = elements.length; i < len; i++) {     // Stored Data 2: the elements themselves
        const element = elements[i];
        dataArray.set(element, offset);
        offset += element.length;
    }
    console.log("Array buffer size: " + (dataArray.length / 1024).toFixed(3) + " kB");
    return dataArray.buffer;
}

module.exports = createXKTFromModel;