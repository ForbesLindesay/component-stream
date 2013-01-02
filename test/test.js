var join = require('path').join;
var fs = require('fs');

describe('piping to a file', function () {
  it('streams the built file straight to a file', function (done) {
    this.timeout(10000);
    var file = fs.createWriteStream(join(__dirname, 'output', 'result.js'));

    var build = require('../');
    build('component/dom', 'master', 'js')
      .pipe(file);
    file.on('close', done);
  })
})
