'use strict';


describe('Client in iframe', function () {
  var wnd1, wnd2;


  before(function (done) {
    wnd1 = window.open('fixtures/client_iframe.html', 'client_local_wnd1');
    wnd2 = window.open('fixtures/client_iframe.html', 'client_local_wnd2');

    function wait() {
      if (!wnd1.liveReady || !wnd2.liveReady) {
        setTimeout(wait, 10);
        return;
      }

      done();
    }

    wait();
  });


  it('.emit', function (done) {
    wnd1.live.on('test.channel.1', function (data, channel) {
      assert.strictEqual(channel, 'test.channel.1');
      assert.strictEqual(data, 'test data');

      done();
    });

    wnd2.live.emit('test.channel.1', 'test data');
  });


  it('.off', function (done) {
    wnd1.live.on('test.channel.2', function () {
      assert.fail(false, 'this should never happens');
    });

    wnd1.live.off('test.channel.2');

    wnd1.live.on('test.channel.3', function () {
      done();
    });

    wnd2.live.emit('test.channel.2', 'test data');
    wnd2.live.emit('test.channel.3', 'test data');
  });


  it('auto generated `id`', function (done) {
    var id;

    wnd1.live.filterIn(function (ch, msg, cb) {
      if (ch === 'test.channel.4') {
        assert.strictEqual(msg.id, id);
        done();
      }

      cb(ch, msg);
    });

    wnd2.live.filterOut(function (ch, msg, cb) {
      id = msg.id;
      cb(ch, msg);
    });

    wnd2.live.emit('test.channel.4', { foo: 'bar' });
  });


  it('.filterIn', function (done) {
    wnd1.live.filterIn(function (ch, msg, cb) {
      if (ch === 'test.channel.5') {
        msg.data.extra = 'baz';
      }

      cb(ch, msg);
    });

    wnd1.live.on('test.channel.5', function (data) {
      assert.deepEqual(data, { foo: 'bar', extra: 'baz' });
      done();
    });

    wnd2.live.emit('test.channel.5', { foo: 'bar' });
  });


  it('.filterOut', function (done) {
    wnd2.live.filterOut(function (ch, msg, cb) {
      if (ch === 'test.channel.6') {
        msg.data.extra = 'baz';
      }

      cb(ch, msg);
    });

    wnd1.live.on('test.channel.6', function (data) {
      assert.deepEqual(data, { foo: 'bar', extra: 'baz' });
      done();
    });

    wnd2.live.emit('test.channel.6', { foo: 'bar' });
  });


  it('.lock', function (done) {
    var execCnt = 0;

    wnd1.live.lock('test_lock_1', function () {
      execCnt++;
    });

    wnd2.live.lock('test_lock_1', 3000, function () {
      execCnt++;
    });

    setTimeout(function () {
      assert.equal(execCnt, 1);
      done();
    }, 200);
  });


  it('.lock - unlock', function (done) {
    var execCnt = 0;

    wnd2.live.lock('test_lock_2', function (unlock) {
      execCnt++;
      unlock();
    });

    setTimeout(function () {
      wnd1.live.lock('test_lock_2', 3000, function () {
        execCnt++;
      });
    }, 100);

    setTimeout(function () {
      assert.equal(execCnt, 2);
      done();
    }, 200);
  });

  describe('lazy init', function() {
    var asyncWnd;

    before(function (done) {
      asyncWnd = window.open('fixtures/client_iframe_async.html', 'client_local_async');

      function waitDOMContentLoaded() {
        if (!asyncWnd.domLoaded) {
          setTimeout(waitDOMContentLoaded, 10);
          return;
        }

        done();
      }

      waitDOMContentLoaded();
    });

    it('still works', function(done) {
      asyncWnd.initTabex();

      function checkIfLive() {
        if (!asyncWnd.liveReady) {
          setTimeout(checkIfLive, 10);
          return;
        }

        done();
      }

      checkIfLive();
    });

    after(function () {
      asyncWnd.close();
    });
  });

  after(function () {
    wnd1.close();
    wnd2.close();
  });
});
