var NinjaPacker = require('../ninja-packer.js');

new NinjaPacker({
  src: './vue',
  entry: './vue/vue.js',
  output: './cache/1.js',
  namespace: 'Vue',
  common : {},
  shim: 'var process = {}; process.env = {}; process.env.NODE_ENV = null;\n',
  done: function () {
    console.log('done-1');
    this.setOptions({
      src: './vue',
      entry: './vue/vue.js',
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