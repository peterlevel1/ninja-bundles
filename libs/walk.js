var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');
var common = require('./common.js');
var getUrl = common.getUrl;
var noop = function () {};

module.exports = readyWalk;

function seriesCallback(next, callback) {
  return function (error, value) {
    if (error)
      callback(error);
    else {
      if (next)
        next(null, value);
      else
        callback(null, value);
    }
  };
}

function onlyOnce(callback) {
  var name = callback.name || 'NO_NAME';
  if (!util.isFunction(callback))
    callback = noop;
  return function () {
    if (!callback)
      throw new Error("callback " + name + " has already been called.");
    var args = Array.prototype.slice.call(arguments);
    callback.apply(null, args);
    callback = null;
  };
}

function makePromisefy(done, error) {
  return function (err, value) {
    if (err)
      error(err);
    else {
      var args = Array.prototype.slice.call(arguments, 1);
      done.apply(null, args);
    }
  };
}

function readyWalk(opts) {
  var dir = util.isString(opts.dir) && opts.dir;
  if (!dir)
    throw new Error('opts.dir is not String: ' + dir);

  var onFile = util.isFunction(opts.onFile) && opts.onFile;
  var onDir = util.isFunction(opts.onDir) && opts.onDir;
  var done = (util.isFunction(opts.done) && opts.done) || noop;
  var error = (util.isFunction(opts.error) && opts.error) || noop;
  done = makePromisefy(done, error);
  done = onlyOnce(done);

  walk(dir, onFile, onDir, done);
}

function lockdir(dir) {
  return function (filename) {
    return path.join(dir, filename);
  };
}

function walk(dir, fileCallback, dirCallback, done, /**/next) {
  var seriesNextDone = seriesCallback(next, done);
  var dir = getUrl(dir);

  if (dirCallback) {
    try {
      if (dirCallback(dir) === false)
        return seriesNextDone(null);
    } catch (err) { return seriesNextDone(err); }
  }

  fs.readdir(dir, function (err, filenames) {
    if (err)
      return done(err);

    filenames = filenames.map(lockdir(dir));
    async.eachSeries(filenames, function (filename, cb) {

      fs.stat(filename, function (err, stats) {
        if (err)
          return cb(err);

        if (stats.isDirectory()) {
          walk(filename, fileCallback, dirCallback, done, cb);
        } else if (stats.isFile()) {
          if (!fileCallback) {
            cb(null);
          } else if (fileCallback.length <= 1) {
            fileCallback(filename);
            cb(null);
          } else {
            fileCallback(filename, cb);
          }
        } else {
          done(new Error('file is not a dir or file: ' + filename));
        }

      });

    }, seriesNextDone);

  });

}

// readyWalk({
//   dir : '../..',
//   onFile: function (file) {
//     console.log(file);
//   },
//   onDir: function (dir) {
//     console.log(dir);
//   },
//   done: function () {
//     console.log('done');
//   },
//   error: function (error) {
//     console.log('aaaaaaa');
//     console.log(error);
//     console.log('---------------');
//   }
// });