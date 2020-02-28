const fs = require('fs');
const math = require('./math');
const utils = require('./utils');
const buildEdgeIndices = require('./buildEdgeIndices');
const Model = require('./Model');
const atob = require('atob');

const WEBGL_COMPONENT_TYPES = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array
};

const WEBGL_TYPE_SIZES = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT2': 4,
    'MAT3': 9,
    'MAT4': 16
};

/**
 * Parses glTF JSON into a {@link Model}.
 *
 * @param {Object} gltf The glTF JSON.
 * @param {Object} options
 * @param {String} [options.basePath] Base directory where binary attachments may be found.
 * @returns {Model} Model parsed from the glTF.
 */
function glTFToModel(gltf, options = {}) {
    const model = new Model();

    const parsingCtx = {
        basePath: options.basePath || "./",
        gltf: gltf,
        model: model,
        numObjects: 0,
        nodes: [],
        _meshInstancesById: {},
        _meshIdToPrimitiveIdsCache: {},
        numOnlyOnceMeshes: 0,
        numMeshInstances: 0
    };

    return new Promise((resolve, reject) => {

        parseBuffers(parsingCtx, () => {

            parseBufferViews(parsingCtx);
            freeBuffers(parsingCtx);
            parseMaterials(parsingCtx);
            parseDefaultScene(parsingCtx);

            model.finalize();

            console.log("Number of objects: " + parsingCtx.numObjects);
            console.log("Only once meshes: " + parsingCtx.numOnlyOnceMeshes);
            console.log("More than once meshes: " + (parsingCtx.numObjects - parsingCtx.numOnlyOnceMeshes));
            console.log("Total mesh instances: " + parsingCtx.numMeshInstances);
            console.log("Instancing factor " + ((parsingCtx.numMeshInstances - parsingCtx.numOnlyOnceMeshes) / parsingCtx.numMeshInstances * 100).toFixed(2) + "%");

            resolve(model);
        });
    });

}

function parseBuffers(parsingCtx, ok) {  // Parses geometry buffers into temporary  "_buffer" Unit8Array properties on the glTF "buffer" elements
    var buffers = parsingCtx.gltf.buffers;
    if (buffers) {
        var numToLoad = buffers.length;
        for (let i = 0, len = buffers.length; i < len; i++) {
            parseBuffer(parsingCtx, buffers[i],
                () => {
                    if (--numToLoad === 0) {
                        ok();
                    }
                },
                (msg) => {
                    console.error(msg);
                    if (--numToLoad === 0) {
                        ok();
                    }
                });
        }
    } else {
        ok();
    }
}

function parseBuffer(parsingCtx, bufferInfo, ok, error) {
    const uri = bufferInfo.uri;
    if (uri) {
        parseArrayBuffer(parsingCtx, uri, (arrayBuffer) => {
            bufferInfo._buffer = arrayBuffer;
            ok();
        }, error);
    } else {
        error('gltf/handleBuffer missing uri in ' + JSON.stringify(bufferInfo));
    }
}

function parseArrayBuffer(parsingCtx, url, ok, err) {
    // Check for data: URI
    var defaultCallback = (_value) => undefined;
    ok = ok || defaultCallback;
    err = err || defaultCallback;
    const dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    const dataUriRegexResult = url.match(dataUriRegex);
    if (dataUriRegexResult) { // Safari can't handle data URIs through XMLHttpRequest
        const isBase64 = !!dataUriRegexResult[2];
        var data = dataUriRegexResult[3];
        data = decodeURIComponent(data);
        if (isBase64) {
            data = atob(data);
        }
        try {
            const buffer = new ArrayBuffer(data.length);
            const view = new Uint8Array(buffer);
            for (var i = 0; i < data.length; i++) {
                view[i] = data.charCodeAt(i);
            }
            ok(buffer);

        } catch (error) {
            err(error);
        }
    } else {

        const absURL = parsingCtx.basePath + url;
        fs.readFile(absURL, (error, contents) => {
            if (error !== null) {
                err(error);
                return;
            }
            const arrayBuffer = toArrayBuffer(contents);
            ok(arrayBuffer);
        });
    }
}

function toArrayBuffer(buf) {
    var ab = new ArrayBuffer(buf.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}

function parseBufferViews(parsingCtx) { // Parses our temporary "_buffer" properties into "_buffer" properties on glTF "bufferView" elements
    const bufferViewsInfo = parsingCtx.gltf.bufferViews;
    if (bufferViewsInfo) {
        for (var i = 0, len = bufferViewsInfo.length; i < len; i++) {
            parseBufferView(parsingCtx, bufferViewsInfo[i]);
        }
    }
}

function parseBufferView(parsingCtx, bufferViewInfo) {
    const buffer = parsingCtx.gltf.buffers[bufferViewInfo.buffer];
    bufferViewInfo._typedArray = null;
    const byteLength = bufferViewInfo.byteLength || 0;
    const byteOffset = bufferViewInfo.byteOffset || 0;
    bufferViewInfo._buffer = buffer._buffer.slice(byteOffset, byteOffset + byteLength);
}

function freeBuffers(parsingCtx) { // Deletes the "_buffer" properties from the glTF "buffer" elements, to save memory
    const buffers = parsingCtx.gltf.buffers;
    if (buffers) {
        for (var i = 0, len = buffers.length; i < len; i++) {
            buffers[i]._buffer = null;
        }
    }
}

function parseMaterials(parsingCtx) {
    const materialsInfo = parsingCtx.gltf.materials;
    if (materialsInfo) {
        var materialInfo;
        var material;
        for (var i = 0, len = materialsInfo.length; i < len; i++) {
            materialInfo = materialsInfo[i];
            material = parseMaterialColor(parsingCtx, materialInfo);
            materialInfo._rgbaColor = material;
        }
    }
}

function parseMaterialColor(parsingCtx, materialInfo) { // Attempts to extract an RGBA color for a glTF material
    const gltf = parsingCtx.gltf;
    const color = new Float32Array([1, 1, 1, 1]);
    const extensions = materialInfo.extensions;
    if (extensions) {
        const specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
        if (specularPBR) {
            const diffuseFactor = specularPBR.diffuseFactor;
            if (diffuseFactor !== null && diffuseFactor !== undefined) {
                color.set(diffuseFactor);
            }
        }
        const common = extensions["KHR_materials_common"];
        if (common) {
            const technique = common.technique;
            const values = common.values || {};
            const blinn = technique === "BLINN";
            const phong = technique === "PHONG";
            const lambert = technique === "LAMBERT";
            const diffuse = values.diffuse;
            if (diffuse && (blinn || phong || lambert)) {
                if (!utils.isString(diffuse)) {
                    color.set(diffuse);
                }
            }
            const transparency = values.transparency;
            if (transparency !== null && transparency !== undefined) {
                color[3] = transparency;
            }
            const transparent = values.transparent;
            if (transparent !== null && transparent !== undefined) {
                color[3] = transparent;
            }
        }
    }
    const metallicPBR = materialInfo.pbrMetallicRoughness;
    if (metallicPBR) {
        const baseColorFactor = metallicPBR.baseColorFactor;
        if (baseColorFactor) {
            color.set(baseColorFactor);
        }
    }
    return color;
}

function parseDefaultScene(parsingCtx) {
    const scene = parsingCtx.gltf.scene || 0;
    const defaultSceneInfo = parsingCtx.gltf.scenes[scene];
    if (!defaultSceneInfo) {
        error(parsingCtx, "glTF has no default scene");
        return;
    }
    prepareSceneCountMeshes(parsingCtx, defaultSceneInfo);
    parseScene(parsingCtx, defaultSceneInfo);
}

function prepareSceneCountMeshes(parsingCtx, sceneInfo) {
    const nodes = sceneInfo.nodes;
    if (!nodes) {
        return;
    }
    for (var i = 0, len = nodes.length; i < len; i++) {
        const glTFNode = parsingCtx.gltf.nodes[nodes[i]];
        if (glTFNode) {
            prepareNodeCountMeshes(parsingCtx, glTFNode);
        }
    }
}

function prepareNodeCountMeshes(parsingCtx, glTFNode) {

    const gltf = parsingCtx.gltf;

    if (glTFNode.mesh !== undefined) {
        if (glTFNode.mesh in parsingCtx._meshInstancesById) {
            parsingCtx._meshInstancesById [glTFNode.mesh]++;
        } else {
            parsingCtx._meshInstancesById [glTFNode.mesh] = 1;
        }
    }

    if (glTFNode.children) {
        const children = glTFNode.children;
        for (let i = 0, len = children.length; i < len; i++) {
            const childNodeIdx = children[i];
            const childGLTFNode = gltf.nodes[childNodeIdx];
            if (!childGLTFNode) {
                continue;
            }
            prepareNodeCountMeshes(parsingCtx, childGLTFNode);
        }
    }
}

function parseScene(parsingCtx, sceneInfo) {
    const nodes = sceneInfo.nodes;
    if (!nodes) {
        return;
    }
    for (var i = 0, len = nodes.length; i < len; i++) {
        const glTFNode = parsingCtx.gltf.nodes[nodes[i]];
        if (glTFNode) {
            parseNode(parsingCtx, glTFNode, null);
        }
    }
}

function parseNode(parsingCtx, glTFNode, matrix) {

    const gltf = parsingCtx.gltf;
    const model = parsingCtx.model;

    let localMatrix;

    if (glTFNode.matrix) {
        localMatrix = glTFNode.matrix;
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, math.mat4());
        } else {
            matrix = localMatrix;
        }
    }

    if (glTFNode.translation) {
        localMatrix = math.translationMat4v(glTFNode.translation);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, localMatrix);
        } else {
            matrix = localMatrix;
        }
    }

    if (glTFNode.rotation) {
        localMatrix = math.quaternionToMat4(glTFNode.rotation);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, localMatrix);
        } else {
            matrix = localMatrix;
        }
    }

    if (glTFNode.scale) {
        localMatrix = math.scalingMat4v(glTFNode.scale);
        if (matrix) {
            matrix = math.mulMat4(matrix, localMatrix, localMatrix);
        } else {
            matrix = localMatrix;
        }
    }

    if (glTFNode.mesh !== undefined) {
        const meshInfo = gltf.meshes[glTFNode.mesh];

        if (meshInfo) {
            let meshOnlyUsedOnce = (parsingCtx._meshInstancesById [glTFNode.mesh] === 1);

            var meshMatrix, entityMatrix;

            if (meshOnlyUsedOnce) {
                meshMatrix = matrix ? matrix.slice() : math.identityMat4();
                entityMatrix = math.identityMat4();
            } else {
                meshMatrix = math.identityMat4();
                entityMatrix = matrix ? matrix.slice() : math.identityMat4();
            }

            const numPrimitives = meshInfo.primitives.length;

            if (numPrimitives > 0) {
                if (!(glTFNode.mesh in parsingCtx._meshIdToPrimitiveIdsCache)) {
                    const meshIds = [];

                    for (let i = 0; i < numPrimitives; i++) {

                        const primitiveInfo = meshInfo.primitives[i];
                        const materialIndex = primitiveInfo.material;
                        const materialInfo = (materialIndex !== null && materialIndex !== undefined) ? gltf.materials[materialIndex] : null;

                        const meshCfg = {
                            id: model.id + "." + parsingCtx.numObjects,
                            matrix: meshMatrix,
                            color: materialInfo ? materialInfo._rgbaColor : new Float32Array([1.0, 1.0, 1.0, 1.0]),
                            opacity: materialInfo ? materialInfo._rgbaColor[3] : 1.0,
                            instanced: (!meshOnlyUsedOnce)
                        };

                        parsePrimitiveGeometry(parsingCtx, primitiveInfo, meshCfg);

                        model.createMesh(meshCfg);

                        meshIds.push(parsingCtx.numObjects);

                        parsingCtx.numObjects++
                    }

                    parsingCtx._meshIdToPrimitiveIdsCache [glTFNode.mesh] = meshIds;
                }

                model.createEntity({
                    id: glTFNode.name,
                    isObject: (!!glTFNode.name),
                    meshIds: parsingCtx._meshIdToPrimitiveIdsCache [glTFNode.mesh],
                    matrix: entityMatrix,
                    usesInstancing: (!meshOnlyUsedOnce)
                });

                if (meshOnlyUsedOnce) {
                    parsingCtx.numOnlyOnceMeshes++;
                } else {
                    parsingCtx.numMeshInstances += parsingCtx._meshIdToPrimitiveIdsCache [glTFNode.mesh].length;
                }
            }
        }
    }

    if (glTFNode.children) {
        const children = glTFNode.children;
        for (let i = 0, len = children.length; i < len; i++) {
            const childNodeIdx = children[i];
            const childGLTFNode = gltf.nodes[childNodeIdx];
            if (!childGLTFNode) {
                error(parsingCtx, "Node not found: " + i);
                continue;
            }
            parseNode(parsingCtx, childGLTFNode, matrix);
        }
    }
}

function parsePrimitiveGeometry(parsingCtx, primitiveInfo, result) {
    const attributes = primitiveInfo.attributes;
    if (!attributes) {
        return;
    }
    result.primitive = "triangles";
    const accessors = parsingCtx.gltf.accessors;
    const indicesIndex = primitiveInfo.indices;
    if (indicesIndex !== null && indicesIndex !== undefined) {
        const accessorInfo = accessors[indicesIndex];
        result.indices = parseAccessorTypedArray(parsingCtx, accessorInfo);
    }
    const positionsIndex = attributes.POSITION;
    if (positionsIndex !== null && positionsIndex !== undefined) {
        const accessorInfo = accessors[positionsIndex];
        result.positions = parseAccessorTypedArray(parsingCtx, accessorInfo);
    }
    const normalsIndex = attributes.NORMAL;
    if (normalsIndex !== null && normalsIndex !== undefined) {
        const accessorInfo = accessors[normalsIndex];
        result.normals = parseAccessorTypedArray(parsingCtx, accessorInfo);
    }
    if (result.indices) {
        result.edgeIndices = buildEdgeIndices(result.positions, result.indices, null, 10);
    }
}

function parseAccessorTypedArray(parsingCtx, accessorInfo) {
    const bufferViewInfo = parsingCtx.gltf.bufferViews[accessorInfo.bufferView];
    const itemSize = WEBGL_TYPE_SIZES[accessorInfo.type];
    const TypedArray = WEBGL_COMPONENT_TYPES[accessorInfo.componentType];
    const elementBytes = TypedArray.BYTES_PER_ELEMENT; // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
    const itemBytes = elementBytes * itemSize;
    if (accessorInfo.byteStride && accessorInfo.byteStride !== itemBytes) { // The buffer is not interleaved if the stride is the item size in bytes.
        error("interleaved buffer!"); // TODO
    } else {
        return new TypedArray(bufferViewInfo._buffer, accessorInfo.byteOffset || 0, accessorInfo.count * itemSize);
    }
}

function error(parsingCtx, msg) {
    parsingCtx.error(msg);
}

module.exports = glTFToModel;