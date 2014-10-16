// Helper file for parsing options and generating transform output for
// methods used in `lib/compiler` and `lib/transform`
//
var fspath = require("path");
var extend = require("./generic").extend;
var generateBanner, parseShebang;

// Depending on the `options` hash, require the appropriate transform
// function
exports.getTransform = function(options) {
	// req variable prevents client side require from getting it as a dependency
	var req = require;
	if (options.generators) {
		if (options.fast) return req("../generators-fast/transform");
		else return req("../generators/transform");
	} else if (options.fibers) {
		if (options.fast) return req("../fibers-fast/transform");
		else return req("../fibers/transform");
	} else {
		return require("../callbacks/transform");
	}
}

// Generate the streamline generation banner
exports.generateBanner = generateBanner = function(options) {
	// important: no newline, to support lines-preserve option!
	var optStr = options.oldStyleFutures ? " --old-style-futures" : "";
	if (options.promise) optStr += " --promise-" + options.promise;
	if (options.standalone) optStr += " --standalone";
	return "/*** Generated by streamline " + options.version + optStr + " - DO NOT EDIT ***/";
}

// parse the shebang `#!` out of the contents
exports.parseShebang = parseShebang = function(content) {
	if (content[0] === '#' && content[1] === '!') {
		var n = content.indexOf("\n");
		var le = "\n";
		if (n != -1) {
			var shebang = content.substr(0, n);
			if (shebang[shebang.length - 1] == "\r") {
				le = "\r\n";
				shebang = shebang.substr(0, shebang.length - 1);
			}
			content = content.substr(n + 1);
			return [shebang, content, le];
		}
	}
	return ['', content, ''];
}

// Take the raw src script and parse out the _shebang_, generate the banner,
// and strip the _shebang_ from the content
exports.getPretransformData = function(content, options) {
	var banner = generateBanner(options);
	var shebangparse = parseShebang(content);
	var shebang = shebangparse[0];
	var le = shebangparse[2];
	return {
		banner: shebang + le + banner,
		content: shebangparse[1]
	}
}

// fill in necessary defaults of transform options
exports.defaults = function(options) {
	options.callback = options.callback || "_";
	options.lines = options.lines || "preserve";
	if (options.sourceMap) {
		options.lines = 'sourcemap';
	}
	return;
}

// compile a `coffee` or `_coffee` piece of src
exports.coffee = function(content, options) {
	var coffee = require("../util/require")("coffee-script");
	var ext;
	if (options.filename) ext = fspath.extname(options.filename);
	content = coffee.compile(content, extend({}, options, {
		generatedFile: ext ? options.filename.replace(ext, ".js") : "unknown.js"
	}));
	return {
		js: content.js ? content.js : content,
		sourceMap: content.v3SourceMap
	}
}