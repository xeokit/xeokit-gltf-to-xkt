import {math} from "./math.js";
import {utils} from "./utils.js";
import {buildEdgeIndices} from './buildEdgeIndices.js';
import atob from "atob";

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

const IDENTITY_MATRIX = math.identityMat4();

const INSTANCE_THRESHOLD = 1;

function parseGLTFIntoModel(gltf, model) {

    var parsingCtx = {
        gltf: gltf,
        model: model,
        numObjects: 0,
        nodes: []
    };

    parseBuffers(parsingCtx); // Parse geometry buffers into temporary  "_buffer" Unit8Array properties on the glTF "buffer" elements
    parseBufferViews(parsingCtx); // Parses our temporary "_buffer" properties into "_buffer" properties on glTF "bufferView" elements
    freeBuffers(parsingCtx); // Delete the "_buffer" properties from the glTF "buffer" elements, to save memory
    parseMaterials(parsingCtx);
    parseDefaultScene(parsingCtx);
}


/**
 * Parse geometry buffers into temporary  "_buffer" Uint8Array properties on the glTF "buffer" elements.
 *
 * We'll then parse those "_buffer" properties in parseBufferViews().
 */
function parseBuffers(parsingCtx) {
    var buffers = parsingCtx.gltf.buffers;
    if (buffers) {
        for (var i = 0, len = buffers.length; i < len; i++) {
            parseBuffer(parsingCtx, buffers[i]);
        }
    }
}

function parseBuffer(parsingCtx, bufferInfo) {
    var uri = bufferInfo.uri;
    if (uri) {
        bufferInfo._buffer = parseArrayBuffer(parsingCtx, uri);
    } else {
        err('gltf/handleBuffer missing uri in ' + JSON.stringify(bufferInfo));
    }
}

function parseArrayBuffer(parsingCtx, url) {
    // Check for data: URI
    var dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    var dataUriRegexResult = url.match(dataUriRegex);
    if (dataUriRegexResult) { // Safari can't handle data URIs through XMLHttpRequest
        var isBase64 = !!dataUriRegexResult[2];
        var data = dataUriRegexResult[3];
        data = decodeURIComponent(data);
        if (isBase64) {
            data = atob(data);
        }
        try {
            var buffer = new ArrayBuffer(data.length);
            var view = new Uint8Array(buffer);
            for (var i = 0; i < data.length; i++) {
                view[i] = data.charCodeAt(i);
            }
            return buffer;
        } catch (error) {
            console.log(error);
            return null;
        }
    } else {
        throw "Geometry buffer must be included in glTF JSON as data URI";
    }
}

/**
 * Parses our temporary "_buffer" properties on glTF "buffer" elements into "_buffer" properties on glTF "bufferView" elements.
 */
function parseBufferViews(parsingCtx) {
    var bufferViewsInfo = parsingCtx.gltf.bufferViews;
    if (bufferViewsInfo) {
        for (var i = 0, len = bufferViewsInfo.length; i < len; i++) {
            parseBufferView(parsingCtx, bufferViewsInfo[i]);
        }
    }
}

function parseBufferView(parsingCtx, bufferViewInfo) {
    var buffer = parsingCtx.gltf.buffers[bufferViewInfo.buffer];
    bufferViewInfo._typedArray = null;
    var byteLength = bufferViewInfo.byteLength || 0;
    var byteOffset = bufferViewInfo.byteOffset || 0;
    bufferViewInfo._buffer = buffer._buffer.slice(byteOffset, byteOffset + byteLength);
}

/**
 * Deletes the "_buffer" properties from the glTF "buffer" elements, to save memory
 */
function freeBuffers(parsingCtx) {
    var buffers = parsingCtx.gltf.buffers;
    if (buffers) {
        for (var i = 0, len = buffers.length; i < len; i++) {
            buffers[i]._buffer = null;
        }
    }
}


function parseMaterials(parsingCtx) {
    var materialsInfo = parsingCtx.gltf.materials;
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

function parseMaterialColor(parsingCtx, materialInfo) { // Substitute RGBA for material, to use fast flat shading instead
    var gltf = parsingCtx.gltf;
    var color = new Float32Array([1, 1, 1, 1]);
    var extensions = materialInfo.extensions;
    if (extensions) {
        var specularPBR = extensions["KHR_materials_pbrSpecularGlossiness"];
        if (specularPBR) {
            var diffuseFactor = specularPBR.diffuseFactor;
            if (diffuseFactor !== null && diffuseFactor !== undefined) {
                color.set(diffuseFactor);
            }
        }
        var common = extensions["KHR_materials_common"];
        if (common) {
            var technique = common.technique;
            var values = common.values || {};
            var blinn = technique === "BLINN";
            var phong = technique === "PHONG";
            var lambert = technique === "LAMBERT";
            var diffuse = values.diffuse;
            if (diffuse && (blinn || phong || lambert)) {
                if (!utils.isString(diffuse)) {
                    color.set(diffuse);
                }
            }
            var transparency = values.transparency;
            if (transparency !== null && transparency !== undefined) {
                color[3] = transparency;
            }
            var transparent = values.transparent;
            if (transparent !== null && transparent !== undefined) {
                color[3] = transparent;
            }
        }
    }
    var metallicPBR = materialInfo.pbrMetallicRoughness;
    if (metallicPBR) {
        var baseColorFactor = metallicPBR.baseColorFactor;
        if (baseColorFactor) {
            color.set(baseColorFactor);
        }
    }
    return color;
}

/**
 * Parses the default glTF scene.
 */
function parseDefaultScene(parsingCtx) {
    var scene = parsingCtx.gltf.scene || 0;
    var defaultSceneInfo = parsingCtx.gltf.scenes[scene];
    if (!defaultSceneInfo) {
        error(parsingCtx, "glTF has no default scene");
        return;
    }
    parseScene(parsingCtx, defaultSceneInfo);
}


/**
 * Parses the given glTF scene.
 */
function parseScene(parsingCtx, sceneInfo) {
    const nodes = sceneInfo.nodes;
    if (!nodes) {
        return;
    }
    for (var i = 0, len = nodes.length; i < len; i++) {
        const glTFNode = parsingCtx.gltf.nodes[nodes[i]];
        if (!glTFNode) {
            error(parsingCtx, "Node not found: " + i);
            continue;
        }
        countMeshUsage(parsingCtx, glTFNode);
    }
    for (var i = 0, len = nodes.length; i < len; i++) {
        const glTFNode = parsingCtx.gltf.nodes[nodes[i]];
        if (glTFNode) {
            parseNode(parsingCtx, glTFNode, null);
        }
    }
}


/**
 * Recursively creates an "instances" property on each glTF "mesh" element.
 *
 * The property is the count of glTF "node" elements that reference the glTF "mesh" element.
 *
 * When a glTF "mesh" has instances == 1, then only one glTF "node" uses the mesh.
 */
function countMeshUsage(parsingCtx, glTFNode) {

    var mesh = glTFNode.mesh;
    if (mesh !== undefined) {
        var meshInfo = parsingCtx.gltf.meshes[glTFNode.mesh];
        if (meshInfo) {
            meshInfo.instances = meshInfo.instances ? meshInfo.instances + 1 : 1;
        }
    }

    if (glTFNode.children) {

        const children = glTFNode.children;

        var childNodeInfo;
        var childNodeIdx;

        for (var i = 0, len = children.length; i < len; i++) {

            childNodeIdx = children[i];
            childNodeInfo = parsingCtx.gltf.nodes[childNodeIdx];

            if (!childNodeInfo) {
                error(parsingCtx, "Node not found: " + i);
                continue;
            }

            countMeshUsage(parsingCtx, childNodeInfo);
        }
    }
}

function parseNode(parsingCtx, glTFNode, matrix) {

    var createEntity;

    var gltf = parsingCtx.gltf;
    var model = parsingCtx.model;

    var localMatrix;

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

            const numPrimitives = meshInfo.primitives.length;

            if (numPrimitives > 0) {

                const meshIds = [];

                for (var i = 0; i < numPrimitives; i++) {
                    const meshCfg = {
                        id: model.id + "." + parsingCtx.numObjects++,
                        matrix: matrix
                    };
                    const primitiveInfo = meshInfo.primitives[i];

                    const materialIndex = primitiveInfo.material;
                    var materialInfo;
                    if (materialIndex !== null && materialIndex !== undefined) {
                        materialInfo = gltf.materials[materialIndex];
                    }
                    if (materialInfo) {
                        meshCfg.color = materialInfo._rgbaColor;
                        meshCfg.opacity = materialInfo._rgbaColor[3];

                    } else {
                        meshCfg.color = new Float32Array([1.0, 1.0, 1.0]);
                        meshCfg.opacity = 1.0;
                    }

                    if (createEntity) {
                        if (createEntity.colorize) {
                            meshCfg.color = createEntity.colorize;
                        }
                        if (createEntity.opacity !== undefined && createEntity.opacity !== null) {
                            meshCfg.opacity = createEntity.opacity;
                        }
                    }

                    if (meshInfo.instances > INSTANCE_THRESHOLD) {

                        //------------------------------------------------------------------
                        // Instancing
                        //------------------------------------------------------------------

                        const geometryId = model.id + "." + glTFNode.mesh + "." + i;
                        if (!primitiveInfo.tilesGeometryIds) {
                            primitiveInfo.tilesGeometryIds = {};
                        }
                        var tileGeometryIds = primitiveInfo.tilesGeometryIds["foo"];
                        if (!tileGeometryIds) {
                            tileGeometryIds = primitiveInfo.tilesGeometryIds["foo"] = {};
                        }
                        if (tileGeometryIds[geometryId] === undefined) { // Ensures we only parse each primitive mesh once
                            tileGeometryIds[geometryId] = geometryId;
                            const geometryCfg = {
                                id: geometryId
                            };
                            parsePrimitiveGeometry(parsingCtx, primitiveInfo, geometryCfg);
                            model.createGeometry(geometryCfg);
                        }

                        meshCfg.geometryId = geometryId;

                        model.createMesh(meshCfg);
                        meshIds.push(meshCfg.id);

                    } else {

                        //------------------------------------------------------------------
                        // Batching
                        //------------------------------------------------------------------

                        parsePrimitiveGeometry(parsingCtx, primitiveInfo, meshCfg);

                        model.createMesh(meshCfg);
                        meshIds.push(meshCfg.id);
                    }
                }

                if (createEntity) {
                    model.createEntity(utils.apply(createEntity, {
                        meshIds: meshIds
                    }));
                } else {
                    model.createEntity({
                        meshIds: meshIds
                    });
                }
            }
        }
    }

    if (glTFNode.children) {
        var children = glTFNode.children;
        var childNodeInfo;
        var childNodeIdx;
        for (let i = 0, len = children.length; i < len; i++) {
            childNodeIdx = children[i];
            childNodeInfo = gltf.nodes[childNodeIdx];
            if (!childNodeInfo) {
                error(parsingCtx, "Node not found: " + i);
                continue;
            }
            parseNode(parsingCtx, childNodeInfo, matrix);
        }
    }
}

function parsePrimitiveGeometry(parsingCtx, primitiveInfo, geometryCfg) {
    var attributes = primitiveInfo.attributes;
    if (!attributes) {
        return;
    }
    geometryCfg.primitive = "triangles";
    var indicesIndex = primitiveInfo.indices;
    if (indicesIndex !== null && indicesIndex !== undefined) {
        const accessorInfo = parsingCtx.gltf.accessors[indicesIndex];
        geometryCfg.indices = parseAccessorTypedArray(parsingCtx, accessorInfo);
    }
    var positionsIndex = attributes.POSITION;
    if (positionsIndex !== null && positionsIndex !== undefined) {
        const accessorInfo = parsingCtx.gltf.accessors[positionsIndex];
        geometryCfg.positions = parseAccessorTypedArray(parsingCtx, accessorInfo);
        //  scalePositionsArray(geometryCfg.positions);
    }
    var normalsIndex = attributes.NORMAL;
    if (normalsIndex !== null && normalsIndex !== undefined) {
        const accessorInfo = parsingCtx.gltf.accessors[normalsIndex];
        geometryCfg.normals = parseAccessorTypedArray(parsingCtx, accessorInfo);
    }
    if (geometryCfg.indices) {
        geometryCfg.edgeIndices = buildEdgeIndices(geometryCfg.positions, geometryCfg.indices, null, 10); // Save model from building edges
    }
}

function parseAccessorTypedArray(parsingCtx, accessorInfo) {
    var bufferViewInfo = parsingCtx.gltf.bufferViews[accessorInfo.bufferView];
    var itemSize = WEBGL_TYPE_SIZES[accessorInfo.type];
    var TypedArray = WEBGL_COMPONENT_TYPES[accessorInfo.componentType];
    var elementBytes = TypedArray.BYTES_PER_ELEMENT; // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
    var itemBytes = elementBytes * itemSize;
    if (accessorInfo.byteStride && accessorInfo.byteStride !== itemBytes) { // The buffer is not interleaved if the stride is the item size in bytes.
        error("interleaved buffer!"); // TODO
    } else {
        return new TypedArray(bufferViewInfo._buffer, accessorInfo.byteOffset || 0, accessorInfo.count * itemSize);
    }
}

function error(parsingCtx, msg) {
    parsingCtx.error(msg);
}

export {parseGLTFIntoModel};