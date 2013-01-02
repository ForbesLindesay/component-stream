var request = require('request');
var Q = require('q');

var requirejs = require('component-require');

//API:
//  get('ForbesLindesay/jssn', 'master', 'js').pipe(process.stdout);
//  get('ForbesLindesay/comic-sans', 'master', 'css').pipe(process.stdout);
//  get('component/dom', 'master', 'js').pipe(process.stdout);
//  get('component/dom', 'master', 'js').pipe(process.stdout);
module.exports = get;
function get(repo, tag, type, options) {
  options = options || {};
  var output = getOutput();
  setTimeout(function () {
    if (type === 'js' && options.excludeRequireJS != true) {
      console.warn('writing requirejs');
      output.write(requirejs);
    }
    write(output, repo, tag, type, options, {})
      .then(function (res) {
        console.warn('writing aliases');
        for (var i = 0; i < res.aliases.length; i++) {
          output.write('require.alias("' + res.aliases[i][0] + '", "' + res.aliases[i][1] + '");\n');
        };
      })
      .done(function () {
        output.strm.end();
      },function (err) {
        output.strm.emit('error', err);
      });
  }, 200);
  return output.strm;
}

function write(output, repo, tag, type, options, done) {
  if (done[repo]) return Q.resolve(done[repo]);
  return getConfig(repo, tag)
    .then(function (config) {
      done[repo] = {config: config, aliases: []};
      var res = Q.resolve(null);
      var aliases = [];

      if (config.dependencies && options.excludeDependencies != true) {
        Object.keys(config.dependencies)
          .forEach(function (dependency) {
            res = res.then(function () {
              return write(output, dependency, config.dependencies[dependency], type, options, done)
                .then(function (res) {
                  for (var i = 0; i < res.aliases.length; i++) {
                    aliases.push(res.aliases[i]);
                  }
                  aliases.push([dependency.replace(/\//, '-') + '/index.js', repo.replace(/\//, '-') + '/deps/' + dependency.replace(/^[^\/]*\//, '') + '/index.js'])
                });
            });
          });
      }
      if (config.development && options.development === true) {
        Object.keys(config.development)
          .forEach(function (dependency) {
            res = res.then(function () {
              return write(output, dependency, config.dependencies[dependency], type, options, done)
                .then(function (res) {
                  for (var i = 0; i < res.aliases.length; i++) {
                    aliases.push(res.aliases[i]);
                  }
                });
            });
          });
      }
      if (config.scripts && type === 'js') {
        config.scripts.forEach(function (script) {
          res = res.then(function () {
            output.write('require.register("' + repo.replace(/\//g, '-') + '/' + script + '", function(exports, require, module){\n');
            return output.write(getFile(repo, tag, script).pipe(indent()));
          })
          .then(function () {
            output.write('\n});\n');
          });

          //todo: output aliases
        });
      }
      if (config.styles && type === 'css') {
        config.styles.forEach(function (style) {
          res = res.then(function () {
            output.write('\n/* ' + repo.replace(/\//g, '-') + '/' + style + ' */\n')
            return output.write(getFile(repo, tag, style));
          });
        });
      }
      return res
        .then(function () {
          return {
            config: config,
            aliases: aliases
          };
        });
    });
}

function getOutput() {
  var strm = require('pass-stream')();
  function write(st) {
    var def = Q.defer();
    if (typeof st === 'string') {
      strm.write(st);
      def.resolve();
    } else {
      st.pipe(strm, {end: false});
      st.on('end', def.resolve);
    }
    return def.promise;
  }
  return {write: write, strm: strm};
}
function getConfig(repo, tag) {
  tag = tag === '*' ? 'master' : (tag || 'master');
  var url = 'https://raw.github.com/' + repo + '/' + tag + '/component.json';
  return Q.nfbind(request)(url)
    .spread(function (res, body) {
      if (res.statusCode != 200) throw new Error('Server response code ' + res.statusCode);
      return JSON.parse(body.toString());
    });
}
function getFile(repo, tag, path) {
  tag = tag === '*' ? 'master' : (tag || 'master');
  var url = 'https://raw.github.com/' + repo + '/' + tag + '/' + path;
  console.warn('writing: ' + url);
  return request(url);
}
function indent() {
  return require('pass-stream')(function (data) {
    this.queueWrite(data.toString()/*.replace(/\n/g, '\n  ')*/);
  });
}