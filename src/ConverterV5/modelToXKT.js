const pako = require('pako');

const XKT_VERSION = 5; // XKT format version

/**
 * Serializes a {@link Model} to an {@link ArrayBuffer}.
 *
 * @param {Model} model The model.
 * @returns {ArrayBuffer} The ArrayBuffer.
 */
function modelToXKT(model) {
    const data = getModelData(model);
    const deflatedData = deflateData(data);
    const arrayBuffer = createArrayBuffer(deflatedData);
    return arrayBuffer;
}

function getModelData(model) {

    const entities = model.entities;
    const primitives = model.primitives;

    const numPrimitives = model.primitives.length;
    const numEntities = model.entities.length;

    let countPositions = 0;
    let countNormals = 0;
    let countIndices = 0;
    let countEdgeIndices = 0;
    let countPrimitives = primitives.length;
    let countEntityMatrices = 0;
    let countColors = 0;

    for (let primitiveIndex = 0; primitiveIndex < numPrimitives; primitiveIndex++) {
        const primitive = primitives [primitiveIndex];
        countPositions += primitive.positions.length;
        countNormals += primitive.normals.length;
        countIndices += primitive.indices.length;
        countEdgeIndices += primitive.edgeIndices.length;
    }

    let countPrimitiveInstances = 0;

    for (let entityIndex = 0; entityIndex < numEntities; entityIndex++) {
        const entity = entities[entityIndex];
        const numEntityPrimitives = entity.primitiveIds.length;
        countPrimitiveInstances += numEntityPrimitives;
        if (entity.instancing) {
            countEntityMatrices++;
        }
    }

    const data = {

        positions: new Float32Array(countPositions), // Flat array of World-space positions for all primitives
        normals: new Int8Array(countNormals), // Flat array of oct-encoded normals for all primitives
        indices: new Uint32Array(countIndices), // Indices for all primitives
        edgeIndices: new Uint32Array(countEdgeIndices), // Edge indices for all primitives

        matrices: new Float32Array(countEntityMatrices * 16), // Flat array of 4x4 matrices for instanced primitives

        eachPrimitivePositionsAndNormalsPortion: new Uint32Array(countPrimitives), // For each primitive, an index to its first element in data.positions and data.normals
        eachPrimitiveIndicesPortion: new Uint32Array(countPrimitives), // For each primitive, an index to its first element in data.indices
        eachPrimitiveEdgeIndicesPortion: new Uint32Array(countPrimitives), // For each primitive, an index to its first element in data.edgeIndices
        eachPrimitiveColor: new Uint8Array(countPrimitives * 4), // For each primitive, an RGBA color [0..255,0..255,0..255,0..255]

        primitiveInstances: new Uint32Array(countPrimitiveInstances), // For each entity, a list of indices into eachPrimitivePositionsAndNormalsPortion, eachPrimitiveIndicesPortion, eachPrimitiveEdgeIndicesPortion, eachPrimitiveDecodeMatricesPortion and eachPrimitiveColor

        eachEntityId: [], // For each entity, an ID string
        eachEntityPrimitiveInstancesPortion: new Uint32Array(numEntities), // For each entity, the index of the the first element of primitiveInstances used by the entity
        eachEntityMatricesPortion: new Uint32Array(numEntities) // For each primitive instance, an index to its first element in data.matrices
    };

    countPositions = 0;
    countNormals = 0;
    countIndices = 0;
    countEdgeIndices = 0;
    countColors = 0;

    // Primitives

    for (let primitiveIndex = 0; primitiveIndex < numPrimitives; primitiveIndex++) {

        const primitive = primitives [primitiveIndex];

        data.positions.set(primitive.positions, countPositions);
        data.normals.set(primitive.normals, countNormals);
        data.indices.set(primitive.indices, countIndices);
        data.edgeIndices.set(primitive.edgeIndices, countEdgeIndices);

        data.eachPrimitivePositionsAndNormalsPortion [primitiveIndex] = countPositions;
        data.eachPrimitiveIndicesPortion [primitiveIndex] = countIndices;
        data.eachPrimitiveEdgeIndicesPortion [primitiveIndex] = countEdgeIndices;
        data.eachPrimitiveColor[countColors + 0] = Math.floor(primitive.color[0] * 255);
        data.eachPrimitiveColor[countColors + 1] = Math.floor(primitive.color[1] * 255);
        data.eachPrimitiveColor[countColors + 2] = Math.floor(primitive.color[2] * 255);
        data.eachPrimitiveColor[countColors + 3] = Math.floor(primitive.opacity * 255);

        countPositions += primitive.positions.length;
        countNormals += primitive.normals.length;
        countIndices += primitive.indices.length;
        countEdgeIndices += primitive.edgeIndices.length;
        countColors += 4;
    }

    // Entities

    countPrimitiveInstances = 0;
    countEntityMatrices = 0;

    for (let entityIndex = 0; entityIndex < numEntities; entityIndex++) {

        const entity = entities [entityIndex];
        const entityPrimitiveIds = entity.primitiveIds;
        const numPrimitivesInEntity = entityPrimitiveIds.length;

        data.eachEntityId [entityIndex] = entity.id;

        data.eachEntityPrimitiveInstancesPortion[entityIndex] = countPrimitiveInstances;

        if (entity.instancing) {
            data.matrices.set(entity.matrix, countEntityMatrices * 16);
            data.eachEntityMatricesPortion [entityIndex] = countEntityMatrices;
            countEntityMatrices++;
        }

        for (let j = 0; j < numPrimitivesInEntity; j++) {
            data.primitiveInstances [countPrimitiveInstances++] = entityPrimitiveIds [j];
        }
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

        eachPrimitivePositionsAndNormalsPortion: pako.deflate(data.eachPrimitivePositionsAndNormalsPortion.buffer),
        eachPrimitiveIndicesPortion: pako.deflate(data.eachPrimitiveIndicesPortion.buffer),
        eachPrimitiveEdgeIndicesPortion: pako.deflate(data.eachPrimitiveEdgeIndicesPortion.buffer),
        eachPrimitiveColor: pako.deflate(data.eachPrimitiveColor.buffer),

        // Each entity has a portion of primitiveInstances.
        // These portions can be shared with other entities.
        // When shared, these portions are always shared as a unit.

        // For each primitive in a shared portion, XKTLoaderPlugin parses it into a geometry, then shares that
        // among multiple meshes, each mesh belonging to a single entity. The geometry is in
        // model-space, and the meshes each use their modeling matrix to transform the geometry into world-space.

        // For each primitive in a non-shared portion, XKTLoaderPlugin parses it into a mesh that belongs
        // to a single entity. The geometry is baked into in world-space, and the mesh does not get a matrix.

        // A shared primitive appears multiple times in primitiveInstances, while a non-shared
        // primitive appears just once.

        // When an entity shares multiple primitives, those multiple primitives are transformed as a unit by the entity's matrix.
        // Within the glTF, those primitives belong, solely, as a unit, to the mesh that is instanced by the glTF scene
        // node, which the entity represents. Therefore, a single matrix on the entity suffices to transform them into World-space.

        primitiveInstances: pako.deflate(data.primitiveInstances.buffer),

        eachEntityId: pako.deflate(JSON.stringify(data.eachEntityId).replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        })),
        eachEntityPrimitiveInstancesPortion: pako.deflate(data.eachEntityPrimitiveInstancesPortion.buffer),
        eachEntityMatricesPortion: pako.deflate(data.eachEntityMatricesPortion.buffer)
    };
}

function createArrayBuffer(deflatedData) {

    return toArrayBuffer([

        deflatedData.positions,
        deflatedData.normals,
        deflatedData.indices,
        deflatedData.edgeIndices,

        deflatedData.matrices,

        deflatedData.eachPrimitivePositionsAndNormalsPortion,
        deflatedData.eachPrimitiveIndicesPortion,
        deflatedData.eachPrimitiveEdgeIndicesPortion,
        deflatedData.eachPrimitiveColor,

        deflatedData.primitiveInstances,

        deflatedData.eachEntityId,
        deflatedData.eachEntityPrimitiveInstancesPortion,
        deflatedData.eachEntityMatricesPortion
    ]);
}

function toArrayBuffer(elements) {
    const indexData = new Uint32Array(elements.length + 2);
    indexData[0] = XKT_VERSION;
    indexData [1] = elements.length;  // Stored Data 1.1: number of stored elements
    let dataLen = 0;    // Stored Data 1.2: length of stored elements
    for (let i = 0, len = elements.length; i < len; i++) {
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

module.exports = modelToXKT;