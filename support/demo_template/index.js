'use strict';


/* global tabex, $ */


$(function () {
  var live = tabex.client();

  live.on('demo', function (message) {
    $('#messages').prepend('<p class="message">' + message + '</p>');
  });

  $('#send').click(function () {
    live.emit('demo', $('#message').val(), true);
  });
});
