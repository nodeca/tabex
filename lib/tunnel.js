// Tunnel to communicate between client in root window and router in iframe
//
'use strict';


/* global document, window */


///////////////////////////////////////////////////////////////////////////////
// Tunnel for client
//
// options:
//
//  - iframe (String) - iframe url
//  - namespace (String) - optional, messages namespace, default 'tabex_default_'
//
function TunnelClient(options) {
  var self = this;

  this.__namespace__ = options.namespace || 'tabex_default_';
  this.__handlers__ = [];

  this.__iframe_url__ = options.iframe;
  this.__iframe_done__ = false;

  // Pending emits before iframe ready
  this.__pending__ = [];

  // Create iframe and hide it
  this.__iframe__ = document.createElement('iframe');
  this.__iframe__.style.left = '-1000px';
  this.__iframe__.style.position = 'absolute';

  // When iframe loaded - send all pending messages
  this.__iframe__.onload = function () {

    // Setup target for messages from iframe (we should not use `*` for security reasons)
    self.__iframe__.contentWindow.postMessage(JSON.stringify({
      // `window.location.origin` available from IE 11
      origin: window.location.origin || window.location.protocol + '//' + window.location.host,
      namespace: self.__namespace__
    }), self.__iframe_url__);

    self.__iframe_done__ = true;

    // Send all pending messages
    self.__pending__.forEach(function (data) {
      self.__iframe__.contentWindow.postMessage(JSON.stringify(data), self.__iframe_url__);
    });

    self.__pending__ = null;
  };

  // Listen messages from iframe
  window.addEventListener('message', function (event) {
    // Check sender origin
    if (self.__iframe_url__.indexOf(event.origin) !== 0) {
      return;
    }

    var data;

    try {
      data = JSON.parse(event.data);
    } catch (__) {
      return;
    }

    // Ignore messages from another namespace (and messages from other possible senders)
    if (data.namespace !== self.__namespace__) {
      return;
    }

    self.__handlers__.forEach(function (handler) {
      handler(data.channel, data.message);
    });
  });

  this.__iframe__.src = this.__iframe_url__;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('body').appendChild(self.__iframe__);
  });
}


// (Same as router API) Broadcast message between all clients
//
// - channel (String) - channel name
// - message (Object) - message data
//
TunnelClient.prototype.broadcast = function (channel, message) {
  // If iframe not loaded - save message locally
  if (!this.__iframe_done__) {
    this.__pending__.push({ channel: channel, message: message, namespace: this.__namespace__ });

  // Send message to iframe
  } else {
    this.__iframe__.contentWindow.postMessage(JSON.stringify({
      channel: channel,
      message: message,
      namespace: this.__namespace__
    }), this.__iframe_url__);
  }
};


// (Same as router API) Subscribe handler to all messages
//
TunnelClient.prototype.onmessage = function (handler) {
  this.__handlers__.push(handler);
};


///////////////////////////////////////////////////////////////////////////////
// Tunnel for router (in iframe)
//
// options:
//
//  - router (RouterLS)
//  - namespace (String) - optional, messages namespace, default 'tabex_default_'
//  - origin (String|Array) - optional, parent window origin to filter messages.
//    You can set `*` to allow everything, but that's not recommended for security
//    reasons. Default iframe origin
//
function TunnelRouter(options) {
  var self = this, i;

  this.__namespace__ = options.namespace || 'tabex_default_';

  // `window.location.origin` available from IE 11
  this.__origin_first_check__ = options.origin ||
                                (window.location.origin || window.location.protocol + '//' + window.location.host);

  // Always convert origin list to array
  if (!Array.isArray(this.__origin_first_check__)) {
    this.__origin_first_check__ = [ this.__origin_first_check__ ];
  }

  for (i = 0; i < this.__origin_first_check__.length; i++) {
    // Escape regexp special chars exclude '*'
    this.__origin_first_check__[i] = this.__origin_first_check__[i].replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    // Replace '*' to '.+' pattern
    this.__origin_first_check__[i] = this.__origin_first_check__[i].replace(/[*]/g, '.+?');
    // Create regexp
    this.__origin_first_check__[i] = new RegExp(this.__origin_first_check__[i]);
  }

  // Origin of parent window (target), will be setup by initial message
  this.__origin__ = null;
  this.__router__ = options.router;

  // Handle messages from parent window
  window.addEventListener('message', function (event) {
    var isOriginValid = false;

    // Check origin
    if (!self.__origin__ || self.__origin__ !== event.origin) {

      // Check origin by pattern
      for (i = 0; i < self.__origin_first_check__.length; i++) {
        if (self.__origin_first_check__[i].test(event.origin)) {
          isOriginValid = true;
          break;
        }
      }

      if (!isOriginValid) {
        return;
      }
    }

    var data;

    try {
      data = JSON.parse(event.data);
    } catch (__) {
      return;
    }

    // Ignore messages from another namespace (and messages from other possible senders)
    if (data.namespace !== self.__namespace__) {
      return;
    }

    // Save real origin from parent window and start routing
    if (!self.__origin__ && data.origin) {
      self.__origin__ = data.origin;

      self.__router__.onmessage(function (channel, message) {
        window.parent.postMessage(JSON.stringify({
          channel: channel,
          message: message,
          namespace: self.__namespace__
        }), self.__origin__);
      });

      return;
    }

    self.__router__.broadcast(data.channel, data.message);
  });
}


exports.TunnelClient = TunnelClient;
exports.TunnelRouter = TunnelRouter;
