#!/usr/bin/env node

var request = require('request')
var url = require('url')
var crypto = require('crypto')
var root = require('root')
var minimist = require('minimist')

var argv = minimist(process.argv, {
  alias: {p:'port', q:'quiet'},
  booleans: ['quiet']
})

var playlist = argv._[2]

if (!playlist) {
  console.error(
    'Usage: hms-decryptor playlist_url [options]\n\n'+
    '  --port,-p   set the port. defaults to 9999\n'+
    '  --quiet,-q  do not print any logs\n\n'
  )
  process.exit(1)
}

var app = root()

var respond = function(proxy, res, body) {
  delete proxy.headers['content-length']
  delete proxy.headers['transfer-encoding']
  delete proxy.headers['content-md5']
  proxy.headers['content-length'] = body.length

  res.writeHead(proxy.statusCode, proxy.headers)
  res.end(body)
}

var encIV = function(seq) {
  var buf = new Buffer(16)
  buf.fill(0)
  buf.writeUInt32BE(seq, 12)
  return buf.toString('hex')
}

var log = function(msg) {
  if (!argv.quiet) console.log(msg)
}

app.get('/', function(req, res) {
  delete req.headers.host

  log('m3u8 : '+playlist)
  request(playlist, {headers:req.headers}, function(err, response) {
    if (err) return res.error(err)

    var body = response.body.trim().split('\n')
    var key
    var iv
    var seq = 0

    body = body
      .map(function(line) {
        if (line.indexOf('#EXT-X-MEDIA-SEQUENCE') === 0) {
          seq = parseInt(line.split(':').pop(), 10)
          return line
        }

        if (line.indexOf('#EXT-X-KEY:METHOD=AES-128') === 0) {
          var parsed = line.match(/URI="([^"]+)"(?:,IV=(.+))?$/)
          key = parsed[1]
          if (parsed[2]) iv = parsed[2].slice(2).toLowerCase()
          return null
        }

        if (line[0] === '#') return line

        return '/ts?url='+encodeURIComponent(line)+'&key='+encodeURIComponent(key || '')+'&iv='+encodeURIComponent(iv || encIV(seq++))
      })
      .filter(function(line) {
        return line
      })
      .join('\n')+'\n'

    respond(response, res, new Buffer(body))
  })
})

app.get('/ts', function(req, res) {
  delete req.headers.host

  var u = url.resolve(playlist, req.query.url)
  log('ts   : '+u)

  request(u, {headers:req.headers, encoding:null}, function(err, response) {
    if (err) return res.error(err)
    if (!req.query.key) return respond(response, res, response.body)

    var ku = url.resolve(playlist, req.query.key)
    log('key  : '+ku)

    request(ku, {headers:req.headers, encoding:null}, function(err, keyResponse) {
      if (err) return res.error(err)

      var key = keyResponse.body
      var iv = new Buffer(req.query.iv, 'hex')
      log('iv   : 0x'+req.query.iv)

      var dc = crypto.createDecipheriv('aes-128-cbc', key, iv)
      var buffer = Buffer.concat([dc.update(response.body), dc.final()])

      respond(response, res, buffer)
    })
  })
})

app.listen(argv.port || 9999, function(addr) {
  console.log('Listening on http://'+addr)
})