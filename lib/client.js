// Base client class
//
'use strict';


var $$ = require('./utils');


// Client
//
// options:
//
//  - router (RouterLS)
//
function Client(options) {
  var self = this;

  // Filers
  this.__filters_in__ = [];
  this.__filters_out__ = [];

  // Subscriptions
  this.__subscriptions__ = [];

  // Current node id
  this.__node_id__ = Math.floor(Math.random() * 1e10) + 1;

  // Message incremental counter
  this.__last_message_cnt__ = 0;

  // List of ignoring messages
  this.__ignore_list__ = {};

  // Router
  this.__router__ = options.router;

  this.__router__.onmessage(function (channel, message) {
    self.__onmessage__(channel, message);
  });
}


// Send message
//
// - channel (String) - channel name
// - message (Object) - message data
// - toSelf (Boolean) - optional, send message also to current client, default false
//
Client.prototype.emit = function (channel, message, toSelf) {
  var self = this;

  var wrappedMessage = {
    id: this.__node_id__ + '_' + (this.__last_message_cnt__++),
    node_id: this.__node_id__,
    data: message
  };

  if (!toSelf) {
    this.__ignore_list__[wrappedMessage.id] = true;
  }

  // Apply out filters
  $$.asyncEach(this.__filters_out__, channel, wrappedMessage, function (ch, msg) {
    self.__router__.broadcast(ch, msg);
  });
};


// Subscribe channel
//
// - channel (String) - channel name
// - handler (Function) - channel handler
//
Client.prototype.on = function (channel, handler) {
  this.__subscriptions__.push({
    channel: channel,
    handler: handler
  });

  this.emit('!sys.channels.add', { channel: channel });

  return this;
};


// Unsubscribe channel
//
// - channel (String) - channel name
// - handler (Function) - optional, all if not set
//
Client.prototype.off = function (channel, handler) {
  var self = this;

  this.__subscriptions__ = this.__subscriptions__.reduce(function (result, subscription) {
    if (subscription.channel === channel && (!handler || handler === subscription.handler)) {
      self.emit('!sys.channels.remove', { channel: channel });
      return result;
    }

    result.push(subscription);

    return result;
  }, []);
};


// Filter input messages
//
// - fn (Function) - `function (channel, message, callback)`, handler for each input message
//   - callback (Function) - `function (channel, message)`
//
Client.prototype.filterIn = function (fn) {
  this.__filters_in__.push(fn);

  return this;
};


// Filter output messages
//
// - fn (Function) - `function (channel, message, callback)`, handler for each output message
//   - callback (Function) - `function (channel, message)`
//
Client.prototype.filterOut = function (fn) {
  this.__filters_out__.push(fn);

  return this;
};


// Receive message from router
//
Client.prototype.__onmessage__ = function (channel, message) {
  var self = this;

  // Apply in filters
  $$.asyncEach(this.__filters_in__, channel, message, function (ch, msg) {
    if (self.__ignore_list__[msg.id]) {
      return;
    }

    self.__subscriptions__.forEach(function (subscription) {
      if (subscription.channel === ch) {
        subscription.handler(msg.data, ch);
      }
    });
  });
};


module.exports = Client;
