"use strict";

/// !doc
///
/// # Compiler and file loader
///
/// `var compiler = require('streamline/lib/compiler/compile')`
///
var fs = require("fs");
var fspath = require("path");
var compileSync = require('../compiler/compileSync');
var utils = require("../util").transform;
var extend = require("../util").generic.extend;
var defaults = utils.defaults,
	getTransform = utils.getTransform,
	getPretransformData = utils.getPretransformData,
	coffee = utils.coffee;

var _exists = _(function(cb, fname) {
		fs.exists(fname, function(result) {
			cb(null, result);
		})
	}, 0);

function mtime(_, fname) {
	return _exists(_, fname) ? fs.stat(fname, ~_).mtime : 0;
}

var _0755 = parseInt("0755", 8);

function mkdirp(_, path) {
	try {
		fs.mkdir(path, _0755, _);
	} catch (err) {
		if (err.code == 'EEXIST') {
			if (fs.stat(path, _).isDirectory()) {
				return;
			}
			throw err;
		}
		if (err.code == 'ENOENT') {
			mkdirp(_, fspath.join(path, '..'));
			fs.mkdir(path, _0755, _);
			return;
		}
		throw err;
	}
}

function outputFile(_, inFile, options) {
	var dirname = fspath.dirname(inFile);
	var outDir;
	if (options.outputDir) {
		if (options.baseDir) {
			outDir = fspath.join(options.outputDir, fspath.relative(options.baseDir, dirname));
		} else {
			outDir = options.outputDir;
		}
	} else {
		outDir = dirname;
	}
	mkdirp(_, outDir);
	var stripped = fspath.basename(inFile, fspath.extname(inFile));
	return fspath.join(outDir, stripped + ".js");
}

/// Transform streamline source
exports.compileFile = function(_, path, options) {
	options = extend({}, options || {});
	var ext = fspath.extname(path);
	var language = ext.substring(2);
	var basename = fspath.basename(path, ext);
	var relpath = fspath.relative('.', path);
	var dstName = outputFile(_, path, options);
	var dirname = fspath.dirname(dstName);

	var mtimeSrc = mtime(_, path);
	var mtimeDst = mtime(_, dstName);
	var transformModule = getTransform(options);

	defaults(options);
	options.sourceName = relpath;
	var content = fs.readFile(path, 'utf8', ~_);
	var preTransformData = getPretransformData(content, extend({}, options, {
		version: transformModule.version
	}));
	var banner = preTransformData.banner;
	content = preTransformData.content;

	if (language === "coffee") {
		var results = coffee(content, {
			filename: relpath,
			sourceFiles: [relpath],
			sourceMap: !!options.sourceMap
		});
		content = results.js;
		options.prevMap = results.sourceMap ? new (require('source-map').SourceMapConsumer)(results.sourceMap): null;
	}

	var transformed = mtimeDst && fs.readFile(dstName, 'utf8', ~_);
	if (transformed && mtimeSrc < mtimeDst && transformed.substring(0, banner.length) == banner && !options.force) {
		return transformed;
	}
	if (options.verbose) {
		console.log("streamline: creating: " + dstName);
	}
	extend(options, {
		source: content
	});
	var transformed = transformModule.transform(content, options);
	var sourceMap;
	var mapFile = options.sourceMapFile || fspath.join(dirname, basename + ".map");
	if (typeof transformed == 'string') {
		transformed = banner + transformed;
		if (options.prevMap) {
			transformed += "\n//# sourceMappingURL=" + (options.sourceMapFile || (basename + ".map")) + "\n";
			sourceMap = require('source-map').SourceMapGenerator.fromSourceMap(options.prevMap);
			options.prevMap = null;
		}
	} else {
		transformed.prepend(banner);
		if (options.sourceMap) {
			transformed.add("\n//# sourceMappingURL=" + (options.sourceMapFile || (basename + ".map")) + "\n");
			var mapPath = fspath.dirname(mapFile);
			sourceMap = transformed.toStringWithSourceMap({
				file: fspath.relative(mapPath, dstName),
				sourceRoot: fspath.relative(mapPath, '.')
			});
			transformed = sourceMap.code;
			sourceMap = sourceMap.map;
		}
	}
	if (options.noWrite) {
		return {
			transformed: transformed,
			sourceMap: sourceMap
		};
	}
	else {
		// try/catch because write will fail if file was installed globally (npm -g)
		try {
			fs.writeFile(dstName, transformed, 'utf8', ~_);
		} catch (ex) {}
		if (options.sourceMap) {
			if (options.prevMap) {
				sourceMap.applySourceMap(options.prevMap, options.sourceName);
			}
			try {
				if (options.verbose) console.log("streamline: creating: " + mapFile);
				fs.writeFile(mapFile, sourceMap.toString(), 'utf8', ~_);
			} catch (ex) {}
		}
	}
}

// * `script = compiler.loadFile(_, path, options)`
//   Loads Javascript file and transforms it if necessary.
//   Returns the transformed source.
//   `options` is a set of options passed to the transformation engine.
//   If `options.force` is set, `foo._js` is transformed even if `foo.js` is more recent.
exports.loadFile = function(_, path, options) {
	options = extend({}, options || {});
	defaults(options);

	var ext = fspath.extname(path);
	if (ext !== '.js' && ext !== '._js') {
		// special hack for streamline-require
		if (_exists(_, path + '._js')) path = path + (ext = '._js');
		else if (_exists(_, path + '.js')) path = path + (ext = '.js');
		else return;
	}
	var basename = fspath.basename(path, ext);
	var dirname = fspath.dirname(path);

	var js = dirname + '/' + basename + ext;
	options.lines = options.lines || "preserve";

	var transformModule = getTransform(options);
	var banner = generateBanner(transformModule.version, options);
	options.sourceName = js;
	var content = fs.readFile(js, 'utf8', ~_);
	var preTransformData = getPretransformData(content, extend({}, options, {
		version: transformModule.version
	}));
	var banner = preTransformData.banner;
	content = preTransformData.content;

	var matches;
	if (ext === '._js') {
		return cachedTransform(_, content, path, transformModule, banner, options);
	} else {
		return content;
	}
}

exports.transformModule = compileSync.transformModule;

function cacheRoot(options) {
	if (options.cacheDir) return options.cacheDir;
	if (process.env.HOME === undefined && process.env.HOMEDRIVE === undefined) throw new Error("HOME not found, unable to store Streamline callback cache");
	return (process.env.HOME || (process.env.HOMEDRIVE + process.env.HOMEPATH).replace(/\\/g, '/')) + "/.streamline";
}

var dirMode = parseInt('777', 8);

function mkdirs(_, path) {
	var p = "",
		i = 0;
	var segs = path.split('/').slice(0, -1);
	while (i < segs.length) {
		var seg = segs[i];
		p += (i++ ? '/' : '') + seg;
		if (!_exists(_, p)) {
			try {
				fs.mkdir(p, dirMode, ~_);
			} catch(err) {
				if (i > 1 && err.code !== 'EEXIST') {
					throw err;
				}
			}
		}
	}
}

function subdir(options) {
	return options.generators ? (options.fast ? 'generators-fast' : 'generators') //
	: options.fibers ? (options.fast ? 'fibers-fast' : 'fibers') //
	: 'callbacks';
}

function cachedTransform(_, content, path, transformModule, banner, options) {
	path = path.replace(/\\/g, '/');
	if (options.cache) {
		var i = path.indexOf('node_modules/');
		if (i < 0) i = path.lastIndexOf('/');
		else i += 'node_modules'.length;

		var dir = cacheRoot(options) + '/' + subdir(options);
		dir += '/' + path.substring(0, i).replace(/[\/\:]/g, '__');
		var f = dir + path.substring(i);
		mkdirs(_, f);
		var transformed;
		if (mtime(_, f) > mtime(_, path)) {
			transformed = fs.readFile(f, "utf8", ~_);
			if (transformed.substring(0, banner.length) === banner) return transformed;
		}
	}
	// no luck in cache
	if (options.verbose) console.log("streamline: transforming: " + path);
	options.lines = options.lines || "sourcemap";
	extend(options, {
		source: content
	});
	transformed = banner + transformModule.transform(content, options);
	if (options.cache && path.indexOf('/tmp--') < 0) fs.writeFile(f, transformed, "utf8", ~_);
	return transformed;
}

exports.cachedTransformSync = compileSync.cachedTransformSync;

function compileCoffee(_, path, options) {
	var jsPath = outputFile(_, path, options);
	var mapPath = jsPath.replace(/\.js$/, '.map');
	var outDir = fspath.dirname(jsPath);
	var coffeeOpts = {
		filename: path,
		sourceMap: options.sourceMap,
		jsPath: jsPath,
		sourceRoot: fspath.relative(outDir, '.'),
		sourceFiles: [fspath.relative('.', path)],
		generatedFile: fspath.basename(jsPath)
	};
	if (options.force || mtime(_, path) > mtime(_, jsPath)) {
		var source = fs.readFile(path, "utf8", ~_);
		var coffee = require("../util/require")("coffee-script");
		var compiled = coffee.compile(source, coffeeOpts);
		if (options.verbose) console.log("streamline: coffee compiling: " + path + " to " + jsPath);
		var js;
		if (options.sourceMap) {
			js = compiled.js + "\n//# sourceMappingURL=" + fspath.basename(mapPath) + "\n";
		} else {
			js = compiled;
		}
		if (options.noWrite) {
			return {
				transformed: js,
				sourceMap: compiled.v3SourceMap
			}
		}
		else {
			fs.writeFile(jsPath, js, "utf8", ~_);
			if (options.sourceMap) {
				fs.writeFile(mapPath, compiled.v3SourceMap, "utf8", ~_);
			}
		}
	}
}

/// Decide which compiler to use for the file type
function _getCompiler(path) {
	var ext = fspath.extname(path);
	if (ext === "._js" || ext === "._coffee") {
		return exports.compileFile;
	} else if (ext === ".coffee" && path[path.length - ext.length - 1] !== '_') {
		return compileCoffee;
	} else {
		// not something we can compile
	}
}

/// Compile streamline or coffee src and return the transformed
/// content.
exports.transform = function(_, path, options) {
	options = extend({
		noWrite: true
	}, options || {});
	var compiler = _getCompiler(path);
	if (compiler) compiler(_, path, options);
}

/// * `compiler.compile(_, paths, options)`
///   Compiles streamline source files in `paths`.
///   Generates a `foo.js` file for each `foo._js` file found in `paths`.
///   `paths` may be a list of files or a list of directories which
///   will be traversed recursively.
///   `options`  is a set of options for the `transform` operation.
exports.compile = function(_, paths, options) {
	function _compile(_, path, base, options) {
		var stat = fs.stat(path, ~_);
		if (stat.isDirectory()) {
			base = base || path;
			fs.readdir(path, ~_).forEach_(_, function(_, f) {
				_compile(_, path + "/" + f, base, options)
			});
		} else if (stat.isFile()) {
			try {
				base = base || fspath.dirname(path);
				options.baseDir = base;
				var compiler = _getCompiler(path);
				if (compiler) compiler(_, path, options);
			} catch (ex) {
				console.error(ex.stack);
				failed++;
			}
		}
		// else ignore
	}

	var failed = 0;
	options = options || {};
	var transformModule = getTransform(options);
	if (options.verbose) console.log("transform version: " + transformModule.version)
	if (!paths || paths.length == 0) throw new Error("cannot compile: no files specified");
	var cwd = process.cwd();
	paths.forEach_(_, function(_, path) {
		_compile(_, fspath.resolve(cwd, path), null, options);
	});
	if (failed) throw new Error("errors found in " + failed + " files");
};
