class Model {

    constructor() {
        this.id = "ffoo";
        this.meshes = [];
        this.entities = [];
        this.geometries = [];
    }

    createEntity(params) {
        this.entities.push(params);
    }

    createGeometry(params) {
        this.geometries [params.id] = params;
    }

    createMesh(params) {

        const geometryId = params.geometryId;

        if (geometryId !== undefined) {
            const meshId = params.id;
            const color = params.color;
            const matrix = params.matrix;
            const opacity = params.opacity;

            params = clone(this.geometries [geometryId]);
            params.id = meshId;
            params.color = color.slice();
            params.matrix = matrix.slice();
            params.opacity = opacity;
        }

        this.meshes.push(params);
    }
}

function clone(obj) {
    var copy;
    if (typeof obj === "string") {
        return obj;
    }
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }
    if (obj instanceof Int8Array ||
        obj instanceof Uint8Array ||
        obj instanceof Uint8ClampedArray ||
        obj instanceof Int16Array ||
        obj instanceof Uint16Array ||
        obj instanceof Int32Array ||
        obj instanceof Uint32Array ||
        obj instanceof Float32Array ||
        obj instanceof Float64Array) {
        return obj.slice();
    }
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported.");
}

export {Model};