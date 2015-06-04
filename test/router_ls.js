'use strict';


var Router = tabex._.Router;


describe('Router', function () {
  it('.broadcast()', function (done) {
    var router = new Router({ namespace: 'Router_1_' });

    router.onmessage(function (channel, message) {
      if (channel !== 'test.channel') {
        return;
      }

      assert.deepEqual(message, 'test data');
      done();
    });

    router.broadcast('test.channel', 'test data');
  });


  it('!sys.master', function (done) {
    var router = new Router({ namespace: 'Router_2_' });

    router.onmessage(function (channel, message) {
      if (channel !== '!sys.master') {
        return;
      }

      assert.deepEqual(message.data.master_id, message.data.node_id);
      done();
    });
  });


  it('!sys.channels.refresh', function (done) {
    var router = new Router({ namespace: 'Router_3_' });

    router.broadcast('!sys.channels.add', { data: { channel: 'foo' } });
    router.broadcast('!sys.channels.add', { data: { channel: 'foo' } });
    router.broadcast('!sys.channels.add', { data: { channel: 'bar' } });
    router.broadcast('!sys.channels.add', { data: { channel: 'baz' } });
    router.broadcast('!sys.channels.remove', { data: { channel: 'bar' } });

    router.onmessage(function (channel, message) {
      if (channel !== '!sys.channels.refresh') {
        return;
      }

      assert.isArray(message.data.channels);
      assert.include(message.data.channels, 'foo');
      assert.include(message.data.channels, 'baz');
      done();
    });
  });
});
