(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}]},{},[1]);
