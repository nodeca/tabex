'use strict';


/* global tabex, $, window */


$(function () {
  var live = tabex.client();

  function log(msg) {
    $('#log').prepend($('<p class="message">').text(msg));
  }

  //////////////////////////////////////////////////////////////////////////////

  $('#createwin').click(function () {
    window.open(window.location.href, '_blank');
  });

  $('#ping').click(function () {
    log('<-- ping');
    live.emit('ping', live.__node_id__);
  });

  $('#send').click(function () {
    var msg = $('#message').val();
    log('<-- ' + (msg || 'empty'));
    live.emit('text', live.__node_id__ + ': ' + (msg || 'empty'));
  });

  //////////////////////////////////////////////////////////////////////////////

  live.on('ping', function (msg) {
    log('--> ' + msg + ': ping');
    log('<-- pong');
    live.emit('pong', live.__node_id__);
  });

  live.on('pong', function (msg) {
    log('--> ' + msg + ': pong');
  });


  live.on('text', function (msg) {
    log('--> ' + msg);
  });

  live.emit('text', 'node ' + live.__node_id__ + ' joined', true);
});
