
function isString(value) {
    return (typeof value === 'string' || value instanceof String);
}

const utils = {
    isString: isString
};

export {utils};
