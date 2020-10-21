const {getBasePath} = require('./lib/utils.js');

const ConverterV1 = require('./ConverterV1');
const ConverterV3 = require('./ConverterV3');
const ConverterV6 = require('./ConverterV6');

const converters = {};

converters[ConverterV1.version] = ConverterV1;
converters[ConverterV3.version] = ConverterV3;
converters[ConverterV6.version] = ConverterV6;

const defaultConverter = ConverterV3;

module.exports = {
	converters,
	defaultConverter,
	getBasePath
};
