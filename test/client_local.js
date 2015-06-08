'use strict';


describe('Client local', function () {
  var wnd1, wnd2;


  before(function (done) {
    wnd1 = window.open('fixtures/client_local.html', 'client_local_wnd1');
    wnd2 = window.open('fixtures/client_local.html', 'client_local_wnd2');

    function wait() {
      if (!wnd1.live || !wnd2.live) {
        setTimeout(wait, 10);
        return;
      }

      done();
    }

    wait();
  });


  it('.emit', function (done) {
    wnd1.live.on('test.channel.1', function (data, cahnnel) {
      assert.strictEqual(cahnnel, 'test.channel.1');
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


  it('.emit multiple times in the same window (IE bug)', function (done) {
    var cnt = 0, timerId;

    wnd1.live.on('test.channel.7', function () {
      if (timerId) {
        clearTimeout(timerId);
      }

      cnt++;

      timerId = setTimeout(function () {
        assert.equal(cnt, 3);
        done();
      }, 200);
    });

    wnd1.live.emit('test.channel.7', { foo: 'bar' }, true);
    wnd1.live.emit('test.channel.7', { foo: 'bar' }, true);
    wnd1.live.emit('test.channel.7', { foo: 'bar' }, true);
  });


  after(function () {
    wnd1.close();
    wnd2.close();
  });
});
