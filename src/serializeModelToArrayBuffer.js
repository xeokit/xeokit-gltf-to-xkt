import {math} from "./math.js";
import {transformAndOctEncodeNormals, quantizePositions} from './batchingLayer.js';

const pako = require('pako');

const tempMat4 = math.mat4();
const tempMat4b = math.mat4();
const tempVec3a = math.vec4([0, 0, 0, 1]);
const tempVec3b = math.vec4([0, 0, 0, 1]);

function serializeModelToArrayBuffer(model) {

    const globalAABB = math.collapseAABB3();

    for (var i = 0, len1 = model.meshes.length; i < len1; i++) {

        const geometryCfg = model.meshes [i];
        const aabb = math.collapseAABB3();
        const matrix = geometryCfg.matrix;
        const transformedPositions = geometryCfg.positions.slice();

        if (matrix) {
            for (var j = 0, len2 = transformedPositions.length; j < len2; j += 3) {
                tempVec3a[0] = transformedPositions[j + 0];
                tempVec3a[1] = transformedPositions[j + 1];
                tempVec3a[2] = transformedPositions[j + 2];
                math.transformPoint4(matrix, tempVec3a, tempVec3b);
                math.expandAABB3Point3(aabb, tempVec3b); // Expand portion AABB
                transformedPositions[j + 0] = tempVec3b[0];
                transformedPositions[j + 1] = tempVec3b[1];
                transformedPositions[j + 2] = tempVec3b[2];
            }
        } else {
            for (var j = 0, len2 = transformedPositions.length; j < len2; j += 3) {
                tempVec3a[0] = transformedPositions[j + 0];
                tempVec3a[1] = transformedPositions[j + 1];
                tempVec3a[2] = transformedPositions[j + 2];
                math.expandAABB3Point3(aabb, tempVec3a);
            }
        }

        math.expandAABB3(globalAABB, aabb);

        geometryCfg.positions = transformedPositions;
        geometryCfg.aabb = aabb;
    }

    const positionsDecodeMatrix = math.mat4();

    for (var i = 0, len = model.meshes.length; i < len; i++) {
        const geometryCfg = model.meshes [i];
        geometryCfg.quantizedPositions = new Uint16Array(geometryCfg.positions.length);
        quantizePositions(geometryCfg.positions, geometryCfg.positions.length, globalAABB, geometryCfg.quantizedPositions, positionsDecodeMatrix);
    }

    for (var i = 0, len = model.meshes.length; i < len; i++) {
        const geometryCfg = model.meshes [i];
        const matrix = geometryCfg.matrix;
        const modelNormalMatrix = tempMat4;
        if (matrix) {  // Order of inverse and transpose doesn't matter
            math.inverseMat4(math.transposeMat4(matrix, tempMat4b), modelNormalMatrix);
        } else {
            math.identityMat4(modelNormalMatrix, modelNormalMatrix);
        }
        geometryCfg.encodedNormals = new Int8Array(geometryCfg.normals.length);
        transformAndOctEncodeNormals(modelNormalMatrix, geometryCfg.normals, geometryCfg.normals.length, geometryCfg.encodedNormals, 0);
    }

    // Simplify id's for geometries and entities

    // Generate the new simplified mesh ids

    const newMeshIds = {};
    for (var i = 0, len = model.meshes.length, totalNumMeshes = 0; i < len; i++, totalNumMeshes++) {
        const geometryCfg = model.meshes [i];
        newMeshIds [geometryCfg.id] = totalNumMeshes;
    }

    for (var i = 0, len = model.entities.length; i < len; i++) { // Remap entities' mesh ids
        const entity = model.entities [i];
        entity.meshIds = entity.meshIds.map(function (oldId) {
            return newMeshIds [oldId];
        });
    }

    const compressedData = compressGeometry(model.entities, model.meshes, positionsDecodeMatrix);
    const arrayBuffer = generateArrayBufferWithCompressedData(compressedData);

    return arrayBuffer;
}

function compressGeometry(entities, meshes, positionsDecodeMatrix) {
    let serializedMeshesCounters = {
        countAllColors: 0,
        countAllEdgeIndices: 0,
        countAllIndices: 0,
        countAllMatrices: 0,
        countAllAABB: 0,
        countAllEncodedNormals: 0,
        countAllOpacities: 0,
        countAllQuantizedPositions: 0,
    };

    var countMeshes = 0;

    for (let i = 0, len = meshes.length; i < len; i++) {
        const mesh = meshes [i];

        serializedMeshesCounters.countAllColors += mesh.color.length;
        serializedMeshesCounters.countAllEdgeIndices += mesh.edgeIndices.length;
        serializedMeshesCounters.countAllIndices += mesh.indices.length;
        serializedMeshesCounters.countAllMatrices += mesh.matrix.length;
        serializedMeshesCounters.countAllEncodedNormals += mesh.encodedNormals.length;
        serializedMeshesCounters.countAllOpacities++;
        serializedMeshesCounters.countAllQuantizedPositions += mesh.quantizedPositions.length;
        serializedMeshesCounters.countAllAABB += mesh.aabb.length;

        countMeshes++;
    }

    const allMeshesData = {
        allColors: new Float32Array(serializedMeshesCounters.countAllColors),
        allEdgeIndices: new Uint16Array(serializedMeshesCounters.countAllEdgeIndices),
        allIndices: new Uint16Array(serializedMeshesCounters.countAllIndices),
        allMatrices: new Float32Array(serializedMeshesCounters.countAllMatrices),
        allEncodedNormals: new Int8Array(serializedMeshesCounters.countAllEncodedNormals),
        allOpacities: new Float32Array(serializedMeshesCounters.countAllOpacities),
        allQuantizedPositions: new Uint16Array(serializedMeshesCounters.countAllQuantizedPositions),
        allAABB: new Float32Array(serializedMeshesCounters.countAllAABB),
    };

    const allEntitiesData = {
        allMeshesIdsForCompress: new Uint32Array(countMeshes),
        allIsObject: new Uint8Array(entities.length),
        allIds: [],
    };

    serializedMeshesCounters = {
        countAllColors: 0,
        countAllEdgeIndices: 0,
        countAllIndices: 0,
        countAllMatrices: 0,
        countAllEncodedNormals: 0,
        countAllOpacities: 0,
        countAllQuantizedPositions: 0,
        countAllAABB: 0,
    };

    const positionsInAllMeshesData = {
        positionColors: new Uint32Array(countMeshes),
        positionEdgeIndices: new Uint32Array(countMeshes),
        positionIndices: new Uint32Array(countMeshes),
        positionMatrices: new Uint32Array(countMeshes),
        positionEncodedNormals: new Uint32Array(countMeshes),
        positionOpacities: new Uint32Array(countMeshes),
        positionQuantizedPositions: new Uint32Array(countMeshes),
        positionAABB: new Uint32Array(countMeshes),
    };

    const positionsInAllEntitiesData = {
        positionMeshes: new Uint32Array(entities.length),
    };

    var countEntities = 0;
    var countEntitiesMeshes = 0;

    for (let i = 0, len = entities.length; i < len; i++) {
        const entity = entities [i];

        allEntitiesData.allMeshesIdsForCompress.set(entity.meshIds, countEntitiesMeshes);
        allEntitiesData.allIds [countEntities] = entity.id;
        allEntitiesData.allIsObject [countEntities] = entity.isObject ? 1 : 0;

        positionsInAllEntitiesData.positionMeshes [countEntities] = countEntitiesMeshes;

        countEntities++;
        countEntitiesMeshes += entity.meshIds.length;
    }

    countMeshes = 0;

    for (let j = 0, len2 = meshes.length; j < len2; j++) {
        const mesh = meshes [j];

        allMeshesData.allColors.set(mesh.color, serializedMeshesCounters.countAllColors);
        allMeshesData.allEdgeIndices.set(mesh.edgeIndices, serializedMeshesCounters.countAllEdgeIndices);
        allMeshesData.allIndices.set(mesh.indices, serializedMeshesCounters.countAllIndices);
        allMeshesData.allMatrices.set(mesh.matrix, serializedMeshesCounters.countAllMatrices);
        allMeshesData.allEncodedNormals.set(mesh.encodedNormals, serializedMeshesCounters.countAllEncodedNormals);
        allMeshesData.allOpacities [serializedMeshesCounters.countAllOpacities] = mesh.opacity;
        allMeshesData.allQuantizedPositions.set(mesh.quantizedPositions, serializedMeshesCounters.countAllQuantizedPositions);
        allMeshesData.allAABB.set(mesh.aabb, serializedMeshesCounters.countAllAABB);

        positionsInAllMeshesData.positionColors [countMeshes] = serializedMeshesCounters.countAllColors;
        positionsInAllMeshesData.positionEdgeIndices [countMeshes] = serializedMeshesCounters.countAllEdgeIndices;
        positionsInAllMeshesData.positionIndices [countMeshes] = serializedMeshesCounters.countAllIndices;
        positionsInAllMeshesData.positionMatrices [countMeshes] = serializedMeshesCounters.countAllMatrices;
        positionsInAllMeshesData.positionEncodedNormals [countMeshes] = serializedMeshesCounters.countAllEncodedNormals;
        positionsInAllMeshesData.positionOpacities [countMeshes] = serializedMeshesCounters.countAllOpacities
        positionsInAllMeshesData.positionQuantizedPositions [countMeshes] = serializedMeshesCounters.countAllQuantizedPositions;
        positionsInAllMeshesData.positionAABB [countMeshes] = serializedMeshesCounters.countAllAABB;

        serializedMeshesCounters.countAllColors += mesh.color.length;
        serializedMeshesCounters.countAllEdgeIndices += mesh.edgeIndices.length;
        serializedMeshesCounters.countAllIndices += mesh.indices.length;
        serializedMeshesCounters.countAllMatrices += mesh.matrix.length;
        serializedMeshesCounters.countAllEncodedNormals += mesh.encodedNormals.length;
        serializedMeshesCounters.countAllOpacities++;
        serializedMeshesCounters.countAllQuantizedPositions += mesh.quantizedPositions.length;
        serializedMeshesCounters.countAllAABB += mesh.aabb.length;

        countMeshes++;
    }

    const compressedData = {

        meshes: {
            allColors: pako.deflate(allMeshesData.allColors.buffer),
            allEdgeIndices: pako.deflate(allMeshesData.allEdgeIndices.buffer),
            allIndices: pako.deflate(allMeshesData.allIndices.buffer),
            allMatrices: pako.deflate(allMeshesData.allMatrices.buffer),
            allEncodedNormals: pako.deflate(allMeshesData.allEncodedNormals.buffer),
            allOpacities: pako.deflate(allMeshesData.allOpacities.buffer),
            allQuantizedPositions: pako.deflate(allMeshesData.allQuantizedPositions.buffer),
            allAABB: pako.deflate(allMeshesData.allAABB.buffer),

            positionColors: pako.deflate(positionsInAllMeshesData.positionColors.buffer),
            positionEdgeIndices: pako.deflate(positionsInAllMeshesData.positionEdgeIndices.buffer),
            positionIndices: pako.deflate(positionsInAllMeshesData.positionIndices.buffer),
            positionMatrices: pako.deflate(positionsInAllMeshesData.positionMatrices.buffer),
            positionEncodedNormals: pako.deflate(positionsInAllMeshesData.positionEncodedNormals.buffer),
            positionOpacities: pako.deflate(positionsInAllMeshesData.positionOpacities.buffer),
            positionQuantizedPositions: pako.deflate(positionsInAllMeshesData.positionQuantizedPositions.buffer),
            positionAABB: pako.deflate(positionsInAllMeshesData.positionAABB.buffer),
        },

        entities: {
            allMeshesIds: pako.deflate(allEntitiesData.allMeshesIdsForCompress.buffer),
            allIds: pako.deflate(JSON.stringify(allEntitiesData.allIds)
                .replace(/[\u007F-\uFFFF]/g, function (chr) {   // produce only ASCII-chars, so that the data can be inflated later
                    return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
                })),
            allIsObject: pako.deflate(allEntitiesData.allIsObject),
            positionMeshes: pako.deflate(positionsInAllEntitiesData.positionMeshes.buffer),
        },

        positionsDecodeMatrix: pako.deflate(positionsDecodeMatrix.buffer),
    };

    // const compressedSize =
    //     compressedData.meshes.allColors.length +
    //     compressedData.meshes.allEdgeIndices.length +
    //     compressedData.meshes.allIndices.length +
    //     compressedData.meshes.allMatrices.length +
    //     compressedData.meshes.allEncodedNormals.length +
    //     compressedData.meshes.allOpacities.length +
    //     compressedData.meshes.allQuantizedPositions.length +
    //     compressedData.meshes.allAABB.length +
    //
    //     compressedData.meshes.positionColors.length +
    //     compressedData.meshes.positionEdgeIndices.length +
    //     compressedData.meshes.positionIndices.length +
    //     compressedData.meshes.positionMatrices.length +
    //     compressedData.meshes.positionEncodedNormals.length +
    //     compressedData.meshes.positionOpacities.length +
    //     compressedData.meshes.positionQuantizedPositions.length +
    //     compressedData.meshes.positionAABB.length +
    //
    //     compressedData.entities.allMeshesIds.length +
    //     compressedData.entities.allIds.length +
    //     compressedData.entities.allIsObject.length +
    //     compressedData.entities.positionMeshes.length +
    //
    //     compressedData.positionsDecodeMatrix.buffer.byteLength; // todo: deflate
    //
    return compressedData;
}

function generateArrayBufferWithCompressedData(compressedData) {
    return toArrayBuffer([
        compressedData.meshes.allColors,
        compressedData.meshes.allEdgeIndices,
        compressedData.meshes.allIndices,
        compressedData.meshes.allMatrices,
        compressedData.meshes.allEncodedNormals,
        compressedData.meshes.allOpacities,
        compressedData.meshes.allQuantizedPositions,
        compressedData.meshes.allAABB,
        compressedData.meshes.positionColors,
        compressedData.meshes.positionEdgeIndices,
        compressedData.meshes.positionIndices,
        compressedData.meshes.positionMatrices,
        compressedData.meshes.positionEncodedNormals,
        compressedData.meshes.positionOpacities,
        compressedData.meshes.positionQuantizedPositions,
        compressedData.meshes.positionAABB,
        compressedData.entities.allMeshesIds,
        compressedData.entities.allIds,
        compressedData.entities.allIsObject,
        compressedData.entities.positionMeshes,
        compressedData.positionsDecodeMatrix
    ]);
}

function toArrayBuffer(dataArr) {
    const dataItemPositions = new Uint32Array(dataArr.length + 1);
    dataItemPositions [0] = dataArr.length;  // Stored Data 1.1: number of stored items
    var dataLen = 0;    // Stored Data 1.2: length of stored items
    for (var i = 0, len = dataArr.length; i < len; i++) {
        dataItemPositions[i + 1] = dataArr[i].length;
        dataLen += dataArr[i].length;
    }
    const positions = new Uint8Array(dataItemPositions.buffer);
    const retVal = new Uint8Array(positions.length + dataLen);
    retVal.set(positions);
    var offset = positions.length;
    for (var i = 0, len = dataArr.length; i < len; i++) {     // Stored Data 2: the items themselves
        retVal.set(dataArr[i], offset);
        offset += dataArr[i].length;
    }
    console.log("arrayBuffer takes " + (retVal.length / 1024).toFixed(3) + " kB");
    return retVal.buffer;
}

export {serializeModelToArrayBuffer};