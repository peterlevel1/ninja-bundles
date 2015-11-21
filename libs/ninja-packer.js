var fs = require('fs');
var walkdir = require('./walk.js');
var path = require('path');
var common = require('./common.js');
var ejs = require('ejs');
var requireRE = /([^.]\s*require\s*\(\s*["'])([^'"\s]+)(["']\s*\))/g;
var throwError = function (err) {
  throw err;
};
var noop = function () {};
var itemFn = getEjsItemCompiled();
var defineFn = getEjsDefineCompiled();

module.exports = NinjaPacker;

function NinjaPacker(opts) {
  if (opts) {
    this.setOptions(opts);
    if (!opts.notWalk)
      this.walk();
  }
}

NinjaPacker.MODE_NORMAL = 1;
NinjaPacker.MODE_MINIFY = 2;

NinjaPacker.prototype.setOptions = function (opts) {
  if (this.walking)
    return this;

  this.src = common.getUrl(opts.src);
  this.base = this.src;
  this.entry = common.getUrl(opts.entry);
  this.output = common.getUrl(opts.output);
  this.namespace = opts.namespace;

  this.common = opts.common || {}
  this.common.namespace = this.common.namespace || this.namespace;

  this.head = opts.head || 'ninja';
  this.shim = opts.shim || '';

  var packMode = ~~(opts.packMode || 0);
  this.packMode = packMode > 2 || packMode <= 0
    ? NinjaPacker.MODE_NORMAL
    : packMode;

  this.files = [];
  this.dirs = [];
  this.map = {};

  this.onFile = opts.onFile || noop;
  this.onDir = opts.onDir || noop;

  this.error = opts.error || throwError;
  this.done = opts.done || noop;

  this.walking = false;

  return this;
};

NinjaPacker.prototype.walk = function () {
  if (this.walking)
    return;
  this.walking = true;

  var self = this;
  walkdir({
    dir: self.src,
    onFile: NinjaPacker.onFile.bind(self),
    onDir: NinjaPacker.onDir.bind(self),
    done: NinjaPacker.onDone.bind(self),
    error: function (err) {
      self.walking = false;
      self.error(err);
    }
  });
};

NinjaPacker.prototype.getCommonFile = function ($filename) {
  return getCommonFile($filename, this.base, this.head);
};

NinjaPacker.prototype.getRequireUrl = function (url) {
  var testUrl = addExtOrNot(url);

  var index = this.files.indexOf(testUrl);
  if (index === -1)
    throw new Error('no this dep file: ' + testUrl);

  var commonFile = this.getCommonFile(url);
  return this.packMode === NinjaPacker.MODE_NORMAL
    ? commonFile
    : this.packMode === NinjaPacker.MODE_MINIFY
    ? index
    : commonFile;
};

NinjaPacker.onDir = function (dirname) {
  if (this.onDir && this.onDir(dirname) === false)
    return false;
  this.dirs.push(dirname);
};

NinjaPacker.onFile = function (filename, next) {
  if (this.onFile && this.onFile(filename) === false)
    return next(null);
  var self = this;
  fs.readFile(filename, 'utf8', function (err, str) {
    if (err)
      return next(err);
    self.files.push(filename);
    self.map[filename] = getFileDescriptor(filename, str);
    next(null);
  });
};

NinjaPacker.prototype.getBufs = function () {
  var self = this;

  return self.files.map(function (filename, index) {
    var file = self.map[filename];

    var factory = file.str.replace(requireRE, function (all, a, b, c) {
      var one = common.getUrl(b, file.dirname);

      if (~self.dirs.indexOf(one)) {
        one = path.join(one, 'index');
        if (!~self.files.indexOf(one + '.js'))
          throw new Error('no file for index.js: ' + one);
      }

      one = self.getRequireUrl(one);
      file.children.push(one);
      return a + one + c;
    });

    var item = itemFn({
      $filename : '"' + self.getRequireUrl(file.$filename) + '"',
      children : JSON.stringify(file.children, null, 2),
      factory : factory,
      minify : self.packMode === NinjaPacker.MODE_MINIFY
    });

    return item;
  });
};

NinjaPacker.onDone = function () {
  var self = this;
  self.walking = false;

  var targetIndex = self.files.indexOf(self.entry);
  if (targetIndex == -1) {
    return self.error(new Error('no entry file for output'));
  }
  self.files.unshift(self.files.splice(targetIndex, 1)[0]);

  var bufs;
  try {
    bufs = self.getBufs();
  } catch (err) {
    return self.error(err);
  }

  var commonString = common(self.common);
  var mods = '[' + bufs.join(',\n') + ']';
  var target = defineFn({ modules: mods });
  commonString.push(self.shim, target, commonString.tail);
  fs.writeFile(self.output, commonString.join(''), function (err) {
    if (err)
      return self.error(err);
    self.done();
  });
};

function getEjsItemCompiled() {
  var str = fs.readFileSync(common.getUrl('./template_pack.ejs', __dirname), 'utf8');
  return ejs.compile(str);
}

function getEjsDefineCompiled() {
  var str = fs.readFileSync(common.getUrl('./template_define.ejs', __dirname), 'utf8');
  return ejs.compile(str);
}

function getFileDescriptor(filename, str) {
  var name = common.justName(filename);
  var dirname = path.dirname(filename);
  var file = {
    filename : filename,
    _filename : (name === 'index' && dirname) || '',
    $filename : filename.replace(path.extname(filename), ''),
    extname : path.extname(filename),
    dirname : dirname,
    name : name,
    children : [],
    looped : null,
    str : (str && (str + '')) || '',
  };
  return file;
}

function getCommonFile(url, base, head) {
  return url.replace(base, head).replace(/[\\]/g, '/');
}

function addExtOrNot(url) {
  return !(/\.js$/.test(url))
    ? url + '.js'
    : url;
}