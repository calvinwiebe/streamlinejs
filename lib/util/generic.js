"use strict";
// Generic helper functions

// extend an object, `arguments[0]`, with an arbitrary list of other objects. Each
// successive object in `arguments` will overwrite previous properties
exports.extend = function() {
	if (arguments.length === 0) return {};
	else if (arguments.length === 1) return arguments[0];
	var obj = arguments[0]
	var others = [].slice.call(arguments, 1);
	for (var i = 0; i < others.length; i++) {
		for (var prop in others[i]) {
			obj[prop] = others[i][prop];
		}
	}
	return obj;
}
