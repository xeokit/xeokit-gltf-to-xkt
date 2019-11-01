const pako = require('pako');

const XKT_VERSION = 2; // XKT format version

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

  let countEntityMeshIds = 0;

  for (let i = 0, len = entities.length; i < len; i++) {
    const entity = entities[i];
    countEntityMeshIds += entity.meshIds.length;
  }

  const data = {
    positions: new Uint16Array(countPositions),
    normals: new Int8Array(countNormals),
    indices: new Uint32Array(countIndices),
    edgeIndices: new Uint32Array(countEdgeIndices),
    meshPositions: new Uint32Array(countMeshes),
    meshIndices: new Uint32Array(countMeshes),
    meshEdgesIndices: new Uint32Array(countMeshes),
    meshColors: new Uint8Array(countMeshes * 4),
    entityIDs: [],
    entityMeshes: new Uint32Array(entities.length),
    entityIsObjects: new Uint8Array(entities.length),
    positionsDecodeMatrix: model.positionsDecodeMatrix,
    entityMeshIds: new Uint32Array(countEntityMeshIds),
    entityMatrices: new Float32Array(entities.length*16),
    entityUsesInstancing: new Uint8Array(entities.length)
  };

  countPositions = 0;
  countNormals = 0;
  countIndices = 0;
  countEdgeIndices = 0;
  countColors = 0;

  // Meshes

  for (let i = 0, len = meshes.length; i < len; i++) {

    const mesh = meshes [i];

    data.positions.set(mesh.positions, countPositions);
    data.normals.set(mesh.normals, countNormals);
    data.indices.set(mesh.indices, countIndices);
    data.edgeIndices.set(mesh.edgeIndices, countEdgeIndices);
    data.meshPositions [i] = countPositions;
    data.meshIndices [i] = countIndices;
    data.meshEdgesIndices [i] = countEdgeIndices;

    data.meshColors[countColors + 0] = Math.floor(mesh.color[0] * 255);
    data.meshColors[countColors + 1] = Math.floor(mesh.color[1] * 255);
    data.meshColors[countColors + 2] = Math.floor(mesh.color[2] * 255);
    data.meshColors[countColors + 3] = Math.floor(mesh.opacity * 255);

    countPositions += mesh.positions.length;
    countNormals += mesh.normals.length;
    countIndices += mesh.indices.length;
    countEdgeIndices += mesh.edgeIndices.length;
    countColors += 4;
  }

  // Entities

  var countEntitiesMeshes = 0;

  for (let i = 0, len = entities.length; i < len; i++) {
    const entity = entities [i];
    data.entityIDs [i] = entity.id;
    data.entityMeshes[i] = countEntitiesMeshes;
    data.entityIsObjects [i] = entity.isObject ? 1 : 0;
    data.entityUsesInstancing [i] = entity.usesInstancing ? 1 : 0;
    for (let j = 0, lenJ = entity.meshIds.length; j < lenJ; j++) {
      data.entityMeshIds [countEntitiesMeshes++] = entity.meshIds [j];
    }
    data.entityMatrices.set(entity.matrix, i*16);
  }

  return data;
}

function deflateData(data) {
  return {
    positions: pako.deflate(data.positions.buffer),
    normals: pako.deflate(data.normals.buffer),
    indices: pako.deflate(data.indices.buffer),
    edgeIndices: pako.deflate(data.edgeIndices.buffer),
    meshPositions: pako.deflate(data.meshPositions.buffer),
    meshIndices: pako.deflate(data.meshIndices.buffer),
    meshEdgesIndices: pako.deflate(data.meshEdgesIndices.buffer),
    meshColors: pako.deflate(data.meshColors.buffer),
    entityIDs: pako.deflate(JSON.stringify(data.entityIDs)
        .replace(/[\u007F-\uFFFF]/g, function (chr) {      // Produce only ASCII-chars, so that the data can be inflated later
          return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        })),
    entityMeshes: pako.deflate(data.entityMeshes.buffer),
    entityIsObjects: pako.deflate(data.entityIsObjects),
    positionsDecodeMatrix: pako.deflate(data.positionsDecodeMatrix.buffer),
    entityMeshIds: pako.deflate(data.entityMeshIds.buffer),
    entityMatrices: pako.deflate(data.entityMatrices.buffer),
    entityUsesInstancing: pako.deflate(data.entityUsesInstancing),
  };
}

function createArrayBuffer(deflatedData) {
  return toArrayBuffer([
    deflatedData.positions,
    deflatedData.normals,
    deflatedData.indices,
    deflatedData.edgeIndices,
    deflatedData.meshPositions,
    deflatedData.meshIndices,
    deflatedData.meshEdgesIndices,
    deflatedData.meshColors,
    deflatedData.entityIDs,
    deflatedData.entityMeshes,
    deflatedData.entityIsObjects,
    deflatedData.positionsDecodeMatrix,
    deflatedData.entityMeshIds,
    deflatedData.entityMatrices,
    deflatedData.entityUsesInstancing,
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