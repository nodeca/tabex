'use strict';


var Router = require('./router');
var Client = require('./client');
var Tunnel = require('./tunnel');


var routerInstances = {};


var Tabex = { _: {} };


// Expose classes for testing
//
Tabex._.Router = Router;
Tabex._.Client = Client;
Tabex._.Tunnel = Tunnel;


// Create client
//
Tabex.client = function (options) {
  options = options || {};

  var namespace = options.namespace || 'tabex_default_';

  var router;

  // If router in iframe (cross-domain) - create tunnel
  if (options.iframe) {
    router = new Tunnel.TunnelClient(options);

  // If router is local (single-domain) - try to reuse existing router
  } else {
    if (!routerInstances[namespace]) {
      routerInstances[namespace] = new Router({
        namespace: namespace
      });
    }

    router = routerInstances[namespace];
  }

  return new Client({ router: router });
};


// Create router
//
Tabex.router = function (options) {
  options = options || {};

  var namespace = options.namespace || 'tabex_default_';

  // Try to reuse existing router
  if (!routerInstances[namespace]) {
    routerInstances[namespace] = new Router({
      namespace: namespace
    });
  }

  // Create tunnel to communicate between router and client
  /* eslint-disable no-new */
  new Tunnel.TunnelRouter({
    router: routerInstances[namespace],
    namespace: namespace,
    origin: options.origin
  });

  return routerInstances[namespace];
};


module.exports = Tabex;
