// LocalStorage router
//
'use strict';


/* global document, window */
var Timer = require('./timer');
var LocalStorage = require('./local_storage');
var $$ = require('./utils');


// Max lifetime of router record in storage
var TIMEOUT = 4000;
// Update router record frequency
var UPDATE_INTERVAL = TIMEOUT / 4;


// Constructor
//
// options:
//
//  - namespace (String) - optional, localStorage keys prefix, default 'tabex_default_'
//
function Router(options) {
  var self = this;

  options = options || {};

  this.__namespace__ = options.namespace || 'tabex_default_';
  this.__node_id__ = Math.floor(Math.random() * 1e10) + 1;
  this.__last_message_cnt__ = 0;
  this.__handlers__ = [];
  this.__router_channels__ = {};

  // Constants for convenience
  this.__router_id_prefix__ = this.__namespace__ + 'router_';
  this.__router_channels_prefix__ = this.__namespace__ + 'subscribed_';
  this.__lock_prefix__ = this.__namespace__ + 'lock_';

  // IE broadcasts storage events also to the same window, we should filter that messages
  this.__storage_events_filter__ = [];

  for (var i = 0; i < 100; i++) {
    this.__storage_events_filter__.push('');
  }

  this.__ls__ = new LocalStorage();

  // Id of master tab
  this.__master_id__ = null;

  // Handle `localStorage` update
  $$.addEvent(window, 'storage', function (e) {
    // IE needs kludge because event fire before data was saved
    if ('onstoragecommit' in document) {
      setTimeout(function () {
        self.__on_changed__(e);
      }, 1);

      return;
    }

    self.__on_changed__(e);
  });

  // Handle page unload (listen `onbeforeunload` and `onunload` to ensure that data is stored successfully)
  // http://stackoverflow.com/questions/3775566/javascript-question-onbeforeunload-or-onunload
  //
  this.__destroyed__ = false;
  $$.addEvent(window, 'beforeunload', function () {
    self.__destroy__();
  });
  $$.addEvent(window, 'unload', function () {
    self.__destroy__();
  });

  // Update current tab info and check master alive
  this.__check_master__();
  Timer.setInterval(function () {
    self.__check_master__();
  }, UPDATE_INTERVAL);

  // Remove outdated lock records
  Timer.setInterval(function () {
    self.__locks_cleanup__();
  }, 1000);
}


// Broadcast message between all clients
//
// - channel (String) - channel name
// - message (Object) - message data
//
Router.prototype.broadcast = function (channel, message) {
  // If it is system subscribe message - update channels list
  if (channel === '!sys.channels.add') {
    this.__router_channels__[message.data.channel] = this.__router_channels__[message.data.channel] || 0;
    this.__router_channels__[message.data.channel]++;
    this.__update_channels_list__();

    return;
  }

  // If it is system unsubscribe message - update channels list
  if (channel === '!sys.channels.remove') {
    this.__router_channels__[message.data.channel] = this.__router_channels__[message.data.channel] || 0;
    this.__router_channels__[message.data.channel]--;
    this.__update_channels_list__();

    return;
  }

  // If it is system lock message - try acquire lock
  if (channel === '!sys.lock.request') {
    this.__lock__(message.data.id, message.id, message.data.timeout);

    return;
  }

  // If it is system unlock message - remove lock data
  if (channel === '!sys.lock.release') {
    this.__ls__.removeItem(this.__lock_prefix__ + message.data.id);

    return;
  }

  var serializedMessage = JSON.stringify({
    channel: channel,
    message: message,

    // Add random to be sure that `localStorage` sent event even new massage is same than previous
    random: Math.floor(Math.random() * 1e10)
  });

  // Add message to `localStorage` to distribute over Router instances
  this.__storage_events_filter__.shift();
  this.__storage_events_filter__.push(this.__namespace__ + 'broadcast' + '_' + serializedMessage);
  this.__ls__.setItem(this.__namespace__ + 'broadcast', serializedMessage);

  // Emit message for all clients and proxies registered on this router
  this.__handlers__.forEach(function (handler) {
    handler(channel, message);
  });
};


// Subscribe handler to all messages
//
Router.prototype.onmessage = function (handler) {
  var self = this;

  this.__handlers__.push(handler);

  // Delay sending events to next tick to allow client initialize handlers
  setTimeout(function () {
    // Sent master info for every new client
    handler('!sys.master', {
      data: {
        node_id: self.__node_id__,
        master_id: self.__master_id__
      },
      node_id: self.__node_id__,
      id: self.__node_id__ + '_' + (self.__last_message_cnt__++)
    });

    // Send channels info
    self.__on_channels_list_changed__();
  }, 0);
};


// Try acquire lock
//
// - lockId (String)
// - requestId (String)
// - timeout (Number)
//
Router.prototype.__lock__ = function (lockId, requestId, timeout) {
  var self = this;
  var lockKey = this.__lock_prefix__ + lockId;
  var lockValue = this.__ls__.getItem(lockKey);

  if (lockValue) {
    try {
      lockValue = JSON.parse(lockValue);
    } catch (__) {
      lockValue = null;
    }
  }

  // If `expire` not in past - lock already acquired, exit here
  if (lockValue && lockValue.expire > Date.now()) {
    return;
  }

  // Try acquire lock
  this.__ls__.setItem(lockKey, JSON.stringify({ expire: timeout + Date.now(), requestId: requestId }));

  // Read lock value again after 30 ms to check `requestId` (race condition
  // here - other tab may rewrite value in store). Delay needed to ensure that
  // localStorage's data synchronized
  setTimeout(function () {
    lockValue = self.__ls__.getItem(lockKey);

    if (lockValue) {
      try {
        lockValue = JSON.parse(lockValue);
      } catch (__) {
        lockValue = null;
      }
    }

    // If `requestId` is not same - other tab acquire lock, exit here
    if (!lockValue || lockValue.requestId !== requestId) {
      return;
    }

    // Here lock acquired - send message to clients
    self.__handlers__.forEach(function (handler) {
      handler('!sys.lock.acquired', {
        data: {
          request_id: requestId
        },
        node_id: self.__node_id__,
        id: self.__node_id__ + '_' + (self.__last_message_cnt__++)
      });
    });
  }, 30);
};


// Remove outdated lock records from storage
//
Router.prototype.__locks_cleanup__ = function () {
  for (var i = 0, key, val; i < this.__ls__.length; i++) {
    key = this.__ls__.key(i);

    // Filter localStorage records by prefix
    if (key.indexOf(this.__lock_prefix__) !== 0) {
      continue;
    }

    val = this.__ls__.getItem(key);

    try {
      val = JSON.parse(val);
    } catch (__) {
      val = null;
    }

    // If lock expire or record is broken - remove it
    if (!val || val.expire < Date.now()) {
      this.__ls__.removeItem(key);
    }
  }
};


// Update master id, if current tab is master - init connect and subscribe channels
//
Router.prototype.__on_master_changed__ = function (newMasterID) {
  var self = this;

  // If master tab closed
  if (!newMasterID) {
    // Select random master (tab with smallest ID becomes master)
    if (this.__get_alive_router_ids__().sort()[0] === this.__node_id__) {
      this.__storage_events_filter__.pop();
      this.__storage_events_filter__.push(this.__namespace__ + 'master' + '_' + this.__node_id__);
      this.__ls__.setItem(this.__namespace__ + 'master', this.__node_id__);
      this.__on_master_changed__(this.__node_id__);
    }
    return;
  }

  this.__master_id__ = +newMasterID;

  this.__handlers__.forEach(function (handler) {
    handler('!sys.master', {
      data: {
        node_id: self.__node_id__,
        master_id: self.__master_id__
      },
      node_id: self.__node_id__,
      id: self.__node_id__ + '_' + (self.__last_message_cnt__++)
    });
  });

  // Send channels info
  self.__on_channels_list_changed__();
};


// localStorage change handler. Updates master ID, receive subscribe requests
//
Router.prototype.__on_changed__ = function (e) {

  // IE broadcasts storage events also to the same window, we should filter that messages
  if (this.__storage_events_filter__.indexOf(e.key + '_' + e.newValue) !== -1) {
    return;
  }

  // Master changed
  if (e.key === this.__namespace__ + 'master') {
    this.__on_master_changed__(e.newValue);
  }

  // Channels list changed
  if (e.key.indexOf(this.__router_channels_prefix__) === 0) {
    this.__on_channels_list_changed__();
  }

  // Emit message for all clients and proxies registered on this router
  if (e.key === this.__namespace__ + 'broadcast') {
    var data = JSON.parse(e.newValue);

    this.__handlers__.forEach(function (handler) {
      handler(data.channel, data.message);
    });
  }
};


// Page unload handler. Remove tab data from store
//
Router.prototype.__destroy__ = function () {
  if (this.__destroyed__) {
    return;
  }

  this.__destroyed__ = true;

  this.__ls__.removeItem(this.__router_id_prefix__ + this.__node_id__);
  this.__ls__.removeItem(this.__router_channels_prefix__ + this.__node_id__);

  if (this.__master_id__ === this.__node_id__) {
    this.__ls__.removeItem(this.__namespace__ + 'master');
  }
};


// Get alive tabs IDs and remove timeouted tabs
//
Router.prototype.__get_alive_router_ids__ = function () {
  var maxTime = Date.now() - TIMEOUT;
  var id;
  var routersIDs = [];

  for (var i = 0, key; i < this.__ls__.length; i++) {
    key = this.__ls__.key(i);

    // Filter localStorage records by prefix
    if (key.indexOf(this.__router_id_prefix__) !== 0) {
      continue;
    }

    id = +key.substr(this.__router_id_prefix__.length);

    // Check router is alive and remove if not
    if (this.__ls__.getItem(key) < maxTime) {
      this.__ls__.removeItem(key);
      this.__ls__.removeItem(this.__router_channels_prefix__ + id);
      continue;
    }

    routersIDs.push(id);
  }

  return routersIDs;
};


// Update tab channels list
//
Router.prototype.__update_channels_list__ = function () {
  var self = this;
  var channels = [];

  Object.keys(this.__router_channels__).forEach(function (channel) {
    if (self.__router_channels__[channel] > 0) {
      channels.push(channel);
    }
  });

  var serializedChannels = JSON.stringify(channels.sort());

  // Update channels list if changed
  if (this.__ls__.getItem(this.__router_channels_prefix__ + this.__node_id__) !== serializedChannels) {
    this.__storage_events_filter__.pop();
    this.__storage_events_filter__.push(this.__router_channels_prefix__ + this.__node_id__ + '_' + serializedChannels);
    this.__ls__.setItem(this.__router_channels_prefix__ + this.__node_id__, serializedChannels);
    this.__on_channels_list_changed__();
  }
};


// Update subscribes if channels list changed (run only on master)
//
Router.prototype.__on_channels_list_changed__ = function () {
  var self = this;
  var channels = [];

  for (var i = 0, key; i < this.__ls__.length; i++) {
    key = this.__ls__.key(i);

    // Filter localStorage records by prefix
    if (key.indexOf(this.__router_channels_prefix__) !== 0) {
      continue;
    }

    channels = channels.concat(JSON.parse(this.__ls__.getItem(key)));
  }

  // Get unique channels names
  channels = channels.reduce(function (result, item) {
    if (result.indexOf(item) === -1) {
      result.push(item);
    }
    return result;
  }, []);

  this.__handlers__.forEach(function (handler) {
    handler('!sys.channels.refresh', {
      id: self.__node_id__ + '_' + (self.__last_message_cnt__++),
      node_id: self.__node_id__,
      data: {
        channels: channels
      }
    });
  });
};


// Update tab livetime and become master if not exists
//
Router.prototype.__check_master__ = function () {
  // Update current tab time
  this.__ls__.setItem(this.__router_id_prefix__ + this.__node_id__, Date.now());

  // Update local value of master ID
  this.__master_id__ = +this.__ls__.getItem(this.__namespace__ + 'master');

  // If master tab not found - become master
  if (this.__get_alive_router_ids__().indexOf(this.__master_id__) === -1) {
    this.__storage_events_filter__.pop();
    this.__storage_events_filter__.push(this.__namespace__ + 'master' + '_' + this.__node_id__);
    this.__ls__.setItem(this.__namespace__ + 'master', this.__node_id__);
    this.__on_master_changed__(this.__node_id__);
  }
};


module.exports = Router;
