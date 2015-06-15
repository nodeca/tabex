// Timers through web workers or fallback to basic if web workers not supported
//
'use strict';


/* global window */
var URL = window.URL;
var Blob = window.Blob;
var Worker = window.Worker;


///////////////////////////////////////////////////////////////////////////////
// Manage timers in web worker
//
function WorkerFn(root) {
  var timers = {};

  root.onmessage = function (event) {
    switch (event.data.type) {
      case 'ping':
        root.postMessage({ type: 'pong' });
        break;

      case 'set_timeout':
        timers[event.data.id] = setTimeout(function () {
          root.postMessage({ type: 'tick', id: event.data.id });
        }, event.data.delay);
        break;

      case 'clear_timeout':
        clearTimeout(timers[event.data.id]);
        break;

      case 'set_interval':
        timers[event.data.id] = setInterval(function () {
          root.postMessage({ type: 'tick', id: event.data.id });
        }, event.data.interval);
        break;

      case 'clear_interval':
        clearInterval(timers[event.data.id]);
        break;
    }
  };
}


///////////////////////////////////////////////////////////////////////////////
// Communicate with web worker to create/destroy timers
//
function TimerWorker(ww) {
  var self = this;

  this.__ww__ = ww;
  this.__timer_handlers__ = {};

  this.__ww__.onmessage = function (event) {
    if (event.data.type === 'tick') {
      self.__timer_handlers__[event.data.id]();
    }
  };
}


TimerWorker.prototype.setTimeout = function (id, fn, delay) {
  this.__timer_handlers__[id] = fn;
  this.__ww__.postMessage({ type: 'set_timeout', delay: delay, id: id });
};


TimerWorker.prototype.clearTimeout = function (id) {
  this.__ww__.postMessage({ type: 'clear_timeout', id: id });
  delete this.__timer_handlers__[id];
};


TimerWorker.prototype.setInterval = function (id, fn, interval) {
  this.__timer_handlers__[id] = fn;
  this.__ww__.postMessage({ type: 'set_interval', interval: interval, id: id });
};


TimerWorker.prototype.clearInterval = function (id) {
  this.__ww__.postMessage({ type: 'clear_interval', id: id });
  delete this.__timer_handlers__[id];
};


///////////////////////////////////////////////////////////////////////////////
// Basic timers API wrapper
//
function TimerStd() {
  this.__timers__ = {};
}


TimerStd.prototype.setTimeout = function (id, fn, delay) {
  this.__timers__[id] = setTimeout(fn, delay);
};


TimerStd.prototype.clearTimeout = function (id) {
  clearInterval(this.__timers__[id]);
};


TimerStd.prototype.setInterval = function (id, fn, interval) {
  this.__timers__[id] = setInterval(fn, interval);
};


TimerStd.prototype.clearInterval = function (id) {
  clearInterval(this.__timers__[id]);
};


///////////////////////////////////////////////////////////////////////////////
// Detect feature and select interface
//
var currentTimer = null;
var pendingCallbacks = [];

function getTimer(callback) {
  // If interface already selected - use it
  if (currentTimer) {
    callback(currentTimer);
    return;
  }

  // Add pending callback
  pendingCallbacks.push(callback);

  // If it is not first call - just wait feature detection finish
  if (pendingCallbacks.length !== 1) {
    return;
  }

  var timeout, url, ww;

  // Remove created data on fallback
  function cleanup() {
    if (url) { URL.revokeObjectURL(url); }
    if (ww) { ww.terminate(); }
    if (timeout) { clearTimeout(timeout); }
  }

  // Try create worker
  try {
    url = URL.createObjectURL(
      new Blob([ '(' + WorkerFn.toString() + ')(this)' ], { type: 'text/javascript' })
    );

    ww = new Worker(url);

  // Can not create worker - fallback to base API
  } catch (__) {
    cleanup();
    currentTimer = new TimerStd();

    pendingCallbacks.forEach(function (cb) {
      cb(currentTimer);
    });
    return;
  }

  // Wait 'pong' message from worker
  ww.onmessage = function (event) {
    if (event.data.type === 'pong') {
      clearInterval(timeout);
      currentTimer = new TimerWorker(ww);

      pendingCallbacks.forEach(function (cb) {
        cb(currentTimer);
      });
    }
  };

  // If no incoming messages from worker - fail (fallback to base API)
  timeout = setTimeout(function () {
    cleanup();
    currentTimer = new TimerStd();

    pendingCallbacks.forEach(function (cb) {
      cb(currentTimer);
    });
  }, 300);

  // Send message to worker
  ww.postMessage({ type: 'ping' });
}


///////////////////////////////////////////////////////////////////////////////
// Exposed API
//

// Incremental timer id for `clearTimeout` and `clearInterval`
//
var idCounter = 1;


// Set timeout
//
// - fn (Function) - timeout handler
// - delay (Number) - delay in ms
//
exports.setTimeout = function (fn, delay) {
  var id = idCounter++;

  getTimer(function (timer) {
    timer.setTimeout(id, fn, delay);
  });

  return id;
};


// Clear timeout
//
// - id (Number) - id returned by `setTimeout`
//
exports.clearTimeout = function (id) {
  getTimer(function (timer) {
    timer.clearTimeout(id);
  });
};


// Set interval
//
// - fn (Function) - tick handler
// - interval (Number) - interval in ms
//
exports.setInterval = function (fn, interval) {
  var id = idCounter++;

  getTimer(function (timer) {
    timer.setInterval(id, fn, interval);
  });

  return id;
};


// Clear interval
//
// - id (Number) - id returned by `setInterval`
//
exports.clearInterval = function (id) {
  getTimer(function (timer) {
    timer.clearInterval(id);
  });
};
