#!/usr/bin/env node

var ebrew = require('./index')

if (process.argv[2] === 'init') {
  var prompt = require('cli-prompt')
  var path = require('path')
  var fs = require('fs')

  var cwd = process.cwd()
  var title = path.basename(cwd)

  console.log('This utility will walk you through creating a book.json manifest file.')
  console.log('It only covers the most common items, and tries to guess sensible defaults.')
  console.log()
  console.log('Press ^C at any time to quit.')

  prompt.multi([{
    key: 'title',
    default: title,
  }, {
    key: 'subtitle',
    default: '',
  }, {
    label: 'author(s)',
    key: 'author',
    default: '',
  }, {
    key: 'date',
    default: function(val) {
      if (this.author) {
        var items = this.author.split(/\s*,\s*/)
        if (items.length > 1) {
          delete this.author
          this.authors = items
        }
      } else {
        delete this.author
      }
      return ebrew.formatDate(new Date)
    }
  }, {
    key: 'publisher',
    default: '',
  }, {
    label: 'rights statement',
    key: 'rights',
    default: function() {
      var d = new Date(this.date)
      return 'Copyright ©'+d.getFullYear()+
        (this.author ? ' '+this.author :
          this.authors ? ' '+ebrew.formatList(this.authors) : '')
    },
  }, {
    label: 'section(s)',
    key: 'contents',
    default: 'book.md',
  }], function(manifest) {
    if (!manifest.publisher) delete manifest.publisher
    if (!manifest.subtitle) delete manifest.subtitle
    var items = manifest.contents.split(/\s*,\s*/)
    if (items.length > 1) manifest.contents = items

    var file = path.join(cwd, 'book.json')
    var data = JSON.stringify(manifest, null, 2)

    console.log('About to write to '+file+':')
    console.log()
    console.log(data)
    console.log()
    prompt('Is this ok? (yes) ', function(res) {
      res = res.toLowerCase()
      if (res && res !== 'y' && res !== 'yes' && res !== 'ok') return
      fs.writeFile(file, data+'\n', {encoding: 'utf8'})
    })
  })
  return
}

ebrew.generate(process.argv[3] || 'book.json', process.argv[2], function(err) {
  if (err) console.error(err.stack || err)
})
