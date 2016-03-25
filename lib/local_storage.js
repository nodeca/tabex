// localStorage wrapper with fallback to memory emulation
//
'use strict';


/* global navigator, document, window */
var localStorage;
var fake_storage = {};

// Check is `localStorage` available and writable
//
var LS_OK = (function () {
  try {
    localStorage = window.localStorage; // can throw SecurityError in chrome if disabled
    if (!localStorage) { return false; }

    localStorage.setItem('live_local_storage_is_writable_test', '');
    localStorage.removeItem('live_local_storage_is_writable_test');
  } catch (__) { return false; }

  // IE 8 does not send `key` and `newValue` in event
  if (document.documentMode && document.documentMode < 9) { return false; }

  // In Chrome browser on iOS localStorage events are not emitted between tabs
  if (navigator.userAgent.match('CriOS')) { return false; }

  return true;
})();


function LocalStorage() {
}


Object.defineProperty(LocalStorage.prototype, 'length', {
  get: function () {
    return LS_OK ? localStorage.length : Object.keys(fake_storage).length;
  }
});


LocalStorage.prototype.getItem = function (key) {
  return LS_OK ? localStorage.getItem(key) : fake_storage.hasOwnProperty(key) ? fake_storage[key] : null;
};


LocalStorage.prototype.setItem = function (key, val) {
  if (LS_OK) {
    localStorage.setItem(key, val);
  } else {
    fake_storage[key] = val;
  }
};


LocalStorage.prototype.removeItem = function (key) {
  if (LS_OK) {
    localStorage.removeItem(key);
  } else {
    fake_storage[key] = null;
  }
};


LocalStorage.prototype.key = function (index) {
  return LS_OK ? localStorage.key(index) : Object.keys(fake_storage)[index];
};


module.exports = LocalStorage;
