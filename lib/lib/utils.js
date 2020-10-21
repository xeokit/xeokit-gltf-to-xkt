function isString(value) {
  return (typeof value === 'string' || value instanceof String);
}

function getBasePath(src) {
    var i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

const utils = {
  isString,
  getBasePath,
};

module.exports = utils;
