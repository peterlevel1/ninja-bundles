var NinjaPacker = require('../libs/ninja-packer.js');
var src = '../node_modules/vue/src';
var entry = src + '/vue.js';

new NinjaPacker({
  src: src,
  entry: entry,
  output: './cache/1.js',
  namespace: 'Vue',
  common : {},
  shim: 'var process = {}; process.env = {}; process.env.NODE_ENV = null;\n',
  done: function () {
    console.log('done-1');
    this.setOptions({
      src: src,
      entry: entry,
      output: './cache/2.js',
      namespace: 'Vue',
      packMode: 2,
      common: {
        deps: ['aaa', 'bbb'],
        amd: true
      },
      shim: 'var process = {}; process.env = {}; process.env.NODE_ENV = null;\n',
      done: function () {
        console.log('done-2');
      }
    })
    .walk();
  }
});