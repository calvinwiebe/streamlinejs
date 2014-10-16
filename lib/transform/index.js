"use strict";

/// !doc
///
/// # One stop transform api
///
/// `var transform = require('streamline/lib/transform')`
///
var fspath = require("path");
var utils = require("../util").transform;
var extend = require("../util").generic.extend;
var defaults = utils.defaults,
	getTransform = utils.getTransform,
	getPretransformData = utils.getPretransformData,
	coffee = utils.coffee;

//   Takes a `contents` string of streamline source and compiles it into `js` using
//   the transform mode specified in `options`
//
//   Note: `options.prevMap` is used as the storage of the coffee sourceMap, as all `transform` functions
//   expect this.
module.exports = function transform(content, options) {
	defaults(options);
	var transformModule = getTransform(options);
	var preTransformData = getPretransformData(content, extend({}, options, {
		version: transformModule.version
	}));
	var banner = preTransformData.banner;
	content = preTransformData.content;
	var _js, ext;

	if (options.filename) {
		ext = fspath.extname(options.filename);
		options.sourceName = options.filename;
	}

	// if src is `coffee`, then coffee compile before transforming
	if (ext && !/js/.test(ext)) {
		if (ext === "._coffee") {
			var results = coffee(content, options);
			_js = results.js;
			if (results.sourceMap) {
				options.prevMap = new (require('source-map').SourceMapConsumer)(results.sourceMap);
			}
		} else if (ext === ".coffee" && options.filename[options.filename.length - ext.length - 1] !== '_') {
			return coffee(content, options);
		}
	} else {
		_js = content;
	}

	// transform functions always expect the `_js` src
	var js = transformModule.transform(_js, options);
	var sourceMap;

	if (typeof js === 'string') {
		js = banner + js;
		if (options.sourceMap && options.prevMap) {
			sourceMap = require('source-map').SourceMapGenerator.fromSourceMap(options.prevMap);
			options.prevMap = null;
		}
	} else {
		js.prepend(banner);
		if (options.sourceMap) {
			sourceMap = js.toStringWithSourceMap({
				file: options.filename && options.filename.replace(ext, '.js'),
				sourceRoot: ''
			});
			js = sourceMap.code;
			sourceMap = sourceMap.map;
		}
	}
	if (options.prevMap) {
		sourceMap.applySourceMap(options.prevMap, options.filename);
	}

	// return the transformed content as a string and the sourceMap as a
	// v3 source map object.
	return {
		js: typeof(js) === 'object'? js.toString() : js,
		sourceMap: sourceMap ? JSON.parse(sourceMap.toString()) : null
	}
}
