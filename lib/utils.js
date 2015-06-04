'use strict';


// Run each function with params and callback after all
//
// - functions ([Function]) - array of functions to run
// - params... - params for functions and callback
// - callback (Function) - execute after all
//
exports.asyncEach = function (functions/* , params..., callback */) {
  functions = functions.slice(0);

  var callback = arguments[arguments.length - 1];
  var params = Array.prototype.slice.call(arguments, 1);

  // Remove callback from params
  params.pop();

  function next() {
    if (functions.length === 0) {
      callback.apply(this, arguments);
      return;
    }

    var fn = functions.shift();

    fn.apply(this, Array.prototype.slice.call(arguments, 0).concat(next));
  }

  next.apply(this, params);
};
