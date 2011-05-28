/*** Generated by streamline 0.1.22 - DO NOT EDIT ***/

"use strict";
var __global = typeof global !== 'undefined' ? global : window;
function __cb(_, fn) { var ctx = __global.__context; return function(err, result) { __global.__context = ctx; if (err) return _(err); return fn(null, result); } }
function __future(fn, args, i) { var done, err, result; var cb = function(e, r) { done = true; err = e, result = r; }; args = Array.prototype.slice.call(args); args[i] = function(e, r) { cb(e, r); }; fn.apply(this, args); return function(_) { if (done) _.call(this, err, result); else cb = _.bind(this); }.bind(this); }
function __nt(_, fn) { var i = 0; var cb = __cb(_, fn); var safeCb = function() { try { cb(); } catch (ex) { __propagate(cb, ex); } }; if (typeof process != "undefined" && typeof process.nextTick == "function") return function() { if (++i % 20 == 0) process.nextTick(safeCb); else cb(); }; else return function() { if (++i % 20 == 0) setTimeout(safeCb); else cb(); }; }
function __propagate(_, err) { try { _(err); } catch (ex) { __trap(ex); } }
function __trap(err) { if (err) { if (__global.__context && __global.__context.errorHandler) __global.__context.errorHandler(err); else console.error("UNCAUGHT EXCEPTION: " + err.message + "\n" + err.stack); } }
var streams = require("./streams");
exports.Reader = function __1(stream, boundary, options) {
  options = (options || {
  });
  options.defaultSize = (options.defaultSize || 512);
  if ((!stream.emitter && (typeof stream.on === "function"))) {
    stream = new streams.ReadableStream(stream, options);
    stream.setEncoding((options.encoding || "utf8"));
  }
;
  if (!boundary) {
    boundary = "\n";
  };
  this.readItem = function __1(_) {
    if (!_) {
      return __future(__1, arguments, 0);
    }
  ;
    var __then = _;
    var chunks = [];
    var len = options.defaultSize;
    return function(__break) {
      var __loop = __nt(_, function() {
        var __then = __loop;
        if (stream) {
          return stream.read(__cb(_, function(__0, chunk) {
            if ((chunk == null)) stream = null;
             else {
              var i = chunk.indexOf(boundary);
              if ((i >= 0)) {
                stream.unread(chunk.substring((i + boundary.length)));
                chunks.push(chunk.substring(0, i));
                return __break();
              }
               else if ((chunk.length == (len + boundary.length))) {
                stream.unread(chunk.substring(len));
                chunks.push(chunk.substring(0, len));
              }
               else {
                return _(new Error(((("missing boundary:" + boundary) + " in: ") + chunk)));
              }
              
            ;
            }
          ;
            return __then();
          }), (len + boundary.length));
        }
         else {
          return __break();
        }
      ;
      });
      return __loop();
    }(function() {
      return _(null, ((chunks.length == 0) ? null : chunks.join("")));
    });
  };
  this.close = function __2(_) {
    if (!_) {
      return __future(__2, arguments, 0);
    }
  ;
    var __then = _;
    stream = null;
    return __then();
  };
};