var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var archiver = require('archiver')
var xml = require('xml')
var slug = require('slug')
var uuid = require('uuid')
var marked = require('marked')
var async = require('async')
var marked = require('marked')
var cheerio = require('cheerio')
var mime = require('mime')

marked.setOptions({
  gfm: true,
  sanitize: false,
  smartypants: true,
})

exports.generate = function generate(input, output, cb) {
  var cwd = process.cwd()
  input = path.resolve(cwd, input)
  var root = path.dirname(input)

  fs.readFile(input, {encoding: 'utf8'}, function(err, data) {
    if (err) return cb(err)

    exports.processManifest(JSON.parse(data), root, function(err, manifest) {
      if (err) return cb(err)

      if (output) {
        output = path.resolve(cwd, output)
        if (!/\.epub$/.test(output)) output += '.epub'
      } else {
        output = path.join(root, slug(manifest.title)+'.epub')
      }

      exports.createArchive({
        manifest: manifest,
        root: root,
        indent: '  ',
      }, function(err, archive) {
        if (err) return cb(err)

        mkdirp(path.dirname(output), function(err) {
          if (err) return cb(err)

          archive.pipe(fs.createWriteStream(output))
          archive.on('end', function() {
            console.log('Generated '+path.relative(process.cwd(), output))
          })
        })
      })
    })
  })
}

exports.processManifest = function(manifest, root, cb) {
  var title = manifest.title || 'Untitled'
  var subtitle = manifest.subtitle || ''
  var language = manifest.language || 'en'
  var contents = strarray(manifest.contents, 'Manifest key "contents" must be a filename or an array of filenames.')
  var authors = strarray(manifest.authors || manifest.author, 'Manifest key "author" or "authors" must be a string or an array of strings', true) || null
  var publisher = manifest.publisher || null
  var tocDepth = manifest.tocDepth || 6;

  var date = manifest.date ? new Date(manifest.date) : new Date
  var created = manifest.created ? new Date(manifest.created) : date
  var copyrighted = manifest.copyrighted ? new Date(manifest.copyrighted) : date

  var rights = manifest.rights || (
    authors ? 'Copyright ©'+copyrighted.getFullYear()+' '+formatList(authors) : null)

  async.map(contents, function(content, cb) {
    fs.readFile(path.resolve(root, content), {encoding: 'utf8'}, cb)
  }, function(err, texts) {
    if (err) return cb(err)

    var headings = []
    var stack = [headings]

    texts = texts.map(function(text, i) {
      return text.replace(/^(#{1,6}).+/gm, function(line, hashes) {
        var n = hashes.length
        var title = line.slice(n).trim()
        while (n > stack.length) {
          var anon = {
            empty: true,
            level: stack.length,
            subheadings: [],
          }
          stack[stack.length - 1].push(anon)
          stack.push(anon.subheadings)
        }
        while (n < stack.length) {
          stack.pop()
        }
        var head = {
          title: title,
          subheadings: [],
          chapter: i,
          level: n,
          id: slug(title),
        }
        stack[stack.length - 1].push(head)
        stack.push(head.subheadings)

        return '<h'+n+' id="'+head.id+'">'+title+'</h'+n+'>'
      })
    })

    var resources = []
    var xhtmls = texts.map(function(text, i) {
      var $ = cheerio.load(marked(text))
      $('img').each(function() {
        if (!/^\w+:/.test(this.attribs.src)) {
          var file = path.resolve(root, contents[i], '..', this.attribs.src)
          var ext = path.extname(this.attribs.src)
          var href = 'resources/'+resources.length+ext
          this.attribs.src = '../'+href
          resources.push({
            file: file,
            href: href,
          })
        }
      })
      return $.xml()
    })

    // console.log(require('util').inspect(headings, null, {depth: -1}))

    cb(null, {
      title: title,
      subtitle: subtitle,
      fullTitle: title + (subtitle ? ': ' + subtitle : ''),
      language: language,
      contents: contents,
      texts: texts,
      xhtmls: xhtmls,
      resources: resources,
      headings: headings,
      authors: authors,
      publisher: publisher,
      date: date,
      created: created,
      copyrighted: copyrighted,
      rights: rights,
      tocDepth: tocDepth,
      uuid: uuid.v4(),
    })
  })
}

exports.createArchive = function createArchive(options, cb) {
  var manifest = options.manifest
  var root = options.root
  var indent = options.indent

  var archive = archiver.create('zip')

  archive.append('application/epub+zip', {
    name: 'mimetype',
    store: true,
  })

  archive.append(xml({
    container: [
      {_attr: {
        version: '1.0',
        xmlns: 'urn:oasis:names:tc:opendocument:xmlns:container',
      }},
      {rootfiles: [
        {rootfile: {_attr: {
          'full-path': 'OEBPS/content.opf',
          'media-type': 'application/oebps-package+xml',
        }}},
      ]},
    ]
  }, {declaration: true, indent: indent}), {name: 'META-INF/container.xml'})

  archive.append(xml({
    package: [
      {_attr: {
        xmlns: 'http://www.idpf.org/2007/opf',
        'unique-identifier': 'uuid',
        version: '2.0',
      }},
      {metadata: [
        {_attr: {
          'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
          'xmlns:opf': 'http://www.idpf.org/2007/opf',
        }},
        {'dc:title': manifest.fullTitle},
        {'dc:language': manifest.language},
        {'dc:rights': manifest.rights},
        {'dc:date': [{_attr: {'opf:event': 'creation'}}, formatDate(manifest.created)]},
        {'dc:date': [{_attr: {'opf:event': 'copyright'}}, formatDate(manifest.copyrighted)]},
        {'dc:date': [{_attr: {'opf:event': 'publication'}}, formatDate(manifest.date)]},
        {'dc:publisher': manifest.publisher},
        {'dc:type': 'Text'},
        {'dc:identifier': [{_attr: {id: 'uuid', 'opf:scheme': 'UUID'}}, manifest.uuid]},
      ].concat(manifest.authors.map(function(author) {
        return {'dc:creator': [{_attr: {'opf:role': 'aut'}}, author]}
      }))},
      {manifest: [
        {item: {_attr: {
          id: 'toc',
          'media-type': 'application/x-dtbncx+xml',
          href: 'toc.ncx'
        }}},
        {item: {_attr: {
          id: 'text-title',
          'media-type': 'application/xhtml+xml',
          href: 'text/_title.xhtml'
        }}},
        {item: {_attr: {
          id: 'style',
          'media-type': 'text/css',
          href: 'style.css'
        }}},
      ].concat(manifest.texts.map(function(text, i) {
        return {item: {_attr: {
          id: 'text-'+i,
          'media-type': 'application/xhtml+xml',
          href: 'text/'+i+'.xhtml',
        }}}
      })).concat(manifest.resources.map(function(res, i) {
        return {item: {_attr: {
          id: 'res-'+i,
          'media-type': mime.lookup(res.href),
          href: res.href,
        }}}
      }))},
      {spine: [
        {_attr: {toc: 'toc'}},
        {itemref: {_attr: {idref: 'text-title'}}},
      ].concat(manifest.texts.map(function(text, i) {
        return {itemref: {_attr: {idref: 'text-'+i}}}
      }))},
    ]
  }, {declaration: true, indent: indent}), {name: 'OEBPS/content.opf'})

  archive.append(ncx([
    {head: [
      {meta: {_attr: {name: 'dtb:uid', content: manifest.uuid}}},
      {meta: {_attr: {name: 'dtb:depth', content: 6}}},
      {meta: {_attr: {name: 'dtb:totalPageCount', content: 0}}},
      {meta: {_attr: {name: 'dtb:maxPageNumber', content: 0}}},
    ]},
    {docTitle: [{text: manifest.title}]},
    {navMap: Array.prototype.concat.apply([], [
      {navPoint: [
        {navLabel: [{text: manifest.title}]},
        {content: {_attr: {src: 'text/_title.xhtml'}}},
      ]},
    ].concat(manifest.headings.map(function np(h) {
      return h.level > manifest.tocDepth ? [] : h.empty ? h.subheadings.map(np) : {navPoint: Array.prototype.concat.apply([], [
        {navLabel: [{text: h.title}]},
        {content: {_attr: {src: 'text/'+h.chapter+'.xhtml#'+h.id}}},
      ].concat(h.subheadings.map(np)))}
    })))},
  ], {indent: indent}), {name: 'OEBPS/toc.ncx'})

  archive.append(xhtml([
    {head: [
      {title: 'Title Page'},
      {link: {_attr: {rel: 'stylesheet', href: '../style.css'}}},
    ]},
    {body: [
      {header: [
        {h1: manifest.title + (manifest.subtitle ? ':' : '')},
      ].concat(manifest.subtitle ? {h2: manifest.subtitle} : []).concat(manifest.authors.length ? [
        {p: [{_attr: {class: 'author'}}, formatList(manifest.authors)]},
      ] : [])},
    ]},
  ], {indent: indent}), {name: 'OEBPS/text/_title.xhtml'})

  manifest.xhtmls.forEach(function(xhtml, i) {
    archive.append(
      XML_DECLARATION + XHTML_DOCTYPE+
      '<html xmlns="http://www.w3.org/1999/xhtml">'+
        '<head>'+
          '<title>Chapter '+(i+1)+'</title>'+
          '<link rel="stylesheet" href="../style.css" />'+
        '</head>'+
        '<body>'+xhtml+'</body>'+
      '</html>', {name: 'OEBPS/text/'+i+'.xhtml'})
  })

  manifest.resources.forEach(function(res) {
    archive.file(res.file, {name: 'OEBPS/'+res.href})
  })

  archive.append(L([
    'header, header h1, header h2 {',
    '  text-align: center;',
    '  hyphens: manual;',
    '  -webkit-hyphens: manual;',
    '  line-height: 1.15;',
    '}',
    'header h1 {',
    '  font-size: 3em;',
    '  margin: 1em 0 0;',
    '}',
    'header h2 {',
    '  font-size: 2em;',
    '  margin: 0.25em 0 0;',
    '}',
    'header .author {',
    '  margin: 4em 0 0;',
    '  font-size: 1.5em;',
    '  font-weight: bold;',
    '}',
    'hr {',
    '  width: 5em;',
    '  height: 1px;',
    '  background: currentColor;',
    '  border: 0;',
    '  margin: 2em auto;',
    '}',
  ]), {name: 'OEBPS/style.css'})

  archive.finalize()
  process.nextTick(cb.bind(null, null, archive))
}

function strarray(data, message, optional) {
  if (optional && !data) return []
  if (typeof data === 'string') data = [data]
  if (!Array.isArray(data)) throw new Error(message)
  return data
}

function formatList(items) {
  switch (items.length) {
    case 0: return ''
    case 1: return items[0]
    case 2: return items[0]+' and '+items[1]
    default: return items.slice(0, -1).join(', ')+', and '+items[items.length - 1]
  }
}
exports.formatList = formatList

function formatDate(date) {
  return date.getUTCFullYear()+'-'+pad0(date.getUTCMonth() + 1)+'-'+pad0(date.getUTCDate())
}
exports.formatDate = formatDate

function pad0(n) {
  return n < 10 ? '0'+n : n
}

var XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'
var XHTML_DOCTYPE = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
var NCX_DOCTYPE = '<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">'

function xhtml(children, opts) {
  return XML_DECLARATION + XHTML_DOCTYPE + xml({
    html: [{_attr: {xmlns: 'http://www.w3.org/1999/xhtml'}}].concat(children)
  }, opts)
}

function ncx(children, opts) {
  return XML_DECLARATION + NCX_DOCTYPE + xml({
    ncx: [{_attr: {
      xmlns: 'http://www.daisy.org/z3986/2005/ncx/',
      version: '2005-1',
    }}].concat(children)
  }, opts)
}

function L(lines) {
  return lines.join('\n') + '\n'
}
