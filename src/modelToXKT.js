const pako = require('pako');

const XKT_VERSION = 4; // XKT format version

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

    console.log("Number of decode matrices: " + (model.decodeMatrices.length / 16));

    const decodeMatrices = model.decodeMatrices;
    const entities = model.entities;
    const meshes = model.meshes;

    let countPositions = 0;
    let countNormals = 0;
    let countIndices = 0;
    let countEdgeIndices = 0;
    let countMeshes = meshes.length;
    let countColors = 0;

    for (let i = 0, len = meshes.length; i < len; i++) {
        const mesh = meshes [i];
        countPositions += mesh.positions.length;
        countNormals += mesh.normals.length;
        countIndices += mesh.indices.length;
        countEdgeIndices += mesh.edgeIndices.length;
    }

    let countMeshInstances = 0;

    for (let i = 0, len = entities.length; i < len; i++) {
        const entity = entities[i];
        countMeshInstances += entity.meshIds.length;
    }

    const data = {

        positions: new Uint16Array(countPositions), // Flat array of quantized World-space positions for all meshes
        normals: new Int8Array(countNormals), // Flat array of oct-encoded normals for all meshes
        indices: new Uint32Array(countIndices), // Indices for all meshes
        edgeIndices: new Uint32Array(countEdgeIndices), // Edge indices for all meshes
        decodeMatrices: new Float32Array(decodeMatrices), // Flat array of 4x4 de-quantize (decode) matrices for all meshes

        eachMeshPositionsAndNormalsPortion: new Uint32Array(countMeshes), // For each mesh, an index to its first element in data.positions and data.normals
        eachMeshIndicesPortion: new Uint32Array(countMeshes), // For each mesh, an index to its first element in data.indices
        eachMeshEdgeIndicesPortion: new Uint32Array(countMeshes), // For each mesh, an index to its first element in data.edgeIndices
        eachMeshDecodeMatricesPortion: new Uint32Array(countMeshes), // For each mesh, an index to its first element in data.decodeMatrices
        eachMeshColor: new Uint8Array(countMeshes * 4), // For each mesh, an RGBA color [0..255,0..255,0..255,0..255]

        meshInstances: new Uint32Array(countMeshInstances), // For each entity, a list of indices into eachMeshPositionsAndNormalsPortion, eachMeshIndicesPortion, eachMeshEdgeIndicesPortion, eachMeshDecodeMatricesPortion and eachMeshColor
        
        eachEntityId: [], // For each entity, an ID string
        eachEntityMeshInstancesPortion: new Uint32Array(entities.length), // For each entity, the index of the the first element of meshInstances used by the entity
        eachEntityMatrix: new Float32Array(entities.length * 16)
    };

    countPositions = 0;
    countNormals = 0;
    countIndices = 0;
    countEdgeIndices = 0;
    countColors = 0;

    // Meshes

    for (let meshIndex = 0, len = meshes.length; meshIndex < len; meshIndex++) {

        const mesh = meshes [meshIndex];

        data.positions.set(mesh.positions, countPositions);
        data.normals.set(mesh.normals, countNormals);
        data.indices.set(mesh.indices, countIndices);
        data.edgeIndices.set(mesh.edgeIndices, countEdgeIndices);

        data.eachMeshPositionsAndNormalsPortion [meshIndex] = countPositions;
        data.eachMeshIndicesPortion [meshIndex] = countIndices;
        data.eachMeshEdgeIndicesPortion [meshIndex] = countEdgeIndices;
        data.eachMeshDecodeMatricesPortion[meshIndex] = mesh.decodeMatrixIdx;
        data.eachMeshColor[countColors + 0] = Math.floor(mesh.color[0] * 255);
        data.eachMeshColor[countColors + 1] = Math.floor(mesh.color[1] * 255);
        data.eachMeshColor[countColors + 2] = Math.floor(mesh.color[2] * 255);
        data.eachMeshColor[countColors + 3] = Math.floor(mesh.opacity * 255);

        countPositions += mesh.positions.length;
        countNormals += mesh.normals.length;
        countIndices += mesh.indices.length;
        countEdgeIndices += mesh.edgeIndices.length;
        countColors += 4;
    }

    // Entities

    countMeshInstances = 0;

    for (let i = 0, len = entities.length; i < len; i++) {
        const entity = entities [i];
        data.eachEntityId [i] = entity.id;
        data.eachEntityMeshInstancesPortion[i] = countMeshInstances;
        for (let j = 0, lenJ = entity.meshIds.length; j < lenJ; j++) {
            data.meshInstances [countMeshInstances++] = entity.meshIds [j];
        }
        data.eachEntityMatrix.set(entity.matrix, i * 16);
    }

    return data;
}

function deflateData(data) {
    return {

        positions: pako.deflate(data.positions.buffer),
        normals: pako.deflate(data.normals.buffer),
        indices: pako.deflate(data.indices.buffer),
        edgeIndices: pako.deflate(data.edgeIndices.buffer),
        decodeMatrices: pako.deflate(data.decodeMatrices.buffer),

        eachMeshPositionsAndNormalsPortion: pako.deflate(data.eachMeshPositionsAndNormalsPortion.buffer),
        eachMeshIndicesPortion: pako.deflate(data.eachMeshIndicesPortion.buffer),
        eachMeshEdgeIndicesPortion: pako.deflate(data.eachMeshEdgeIndicesPortion.buffer),
        eachMeshDecodeMatricesPortion: pako.deflate(data.eachMeshDecodeMatricesPortion.buffer),
        eachMeshColor: pako.deflate(data.eachMeshColor.buffer),

        // Each entity has a portion of meshInstances.
        // These portions can be shared with other entities.
        // When shared, these portions are always shared as a unit.

        meshInstances: pako.deflate(data.meshInstances.buffer),

        eachEntityId: pako.deflate(JSON.stringify(data.eachEntityId).replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        })),
        eachEntityMeshInstancesPortion: pako.deflate(data.eachEntityMeshInstancesPortion.buffer),
        eachEntityMatrix: pako.deflate(data.eachEntityMatrix.buffer)
    };
}

function createArrayBuffer(deflatedData) {

    return toArrayBuffer([

        deflatedData.positions,
        deflatedData.normals,
        deflatedData.indices,
        deflatedData.edgeIndices,
        deflatedData.decodeMatrices,

        deflatedData.eachMeshPositionsAndNormalsPortion,
        deflatedData.eachMeshIndicesPortion,
        deflatedData.eachMeshEdgeIndicesPortion,
        deflatedData.eachMeshDecodeMatricesPortion,
        deflatedData.eachMeshColor,

        deflatedData.meshInstances,

        deflatedData.eachEntityId,
        deflatedData.eachEntityMeshInstancesPortion,
        deflatedData.eachEntityMatrix
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
    console.log("arrayBuffer takes " + (dataArray.length / 1024).toFixed(3) + " kB");
    return dataArray.buffer;
}

module.exports = modelToXKT;