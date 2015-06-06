# EBREW

EBREW lets you create EPUB books and documents using Markdown and a simple JSON metadata format. To get started, install `ebrew` via npm and start a new book:

    > npm i -g ebrew

    > cd ~/projects
    > mkdir lorem-ipsum && cd $_
    > ebrew init
    ...

Follow the prompts to set up a `book.json` manifest, which stores information about your book. Then, get writing!

    > cat >book.md
    # Lorem

    Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
    tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
    veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
    commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
    velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
    cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
    est laborum.

    ## Ipsum

    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
    aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
    voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
    sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
    mollit anim id est laborum.
    ^D

When you're done (or you just want to see how things are looking), use `ebrew` to generate your book:

    > ebrew
    Generated Lorem-Ipsum.epub

You can specify the output filename and the path to your manifest, but EBREW picks sensible defaults so you usually won't have to.

# Sections

As your book gets larger, it's nice to be able to split it up into manageable chunks. The `contents` manifest key lets you put each section in its own `.md` file and join them together in the final product. For example:

```json
{
  "title": "Lorem Ipsum",
  "contents": [
    "lorem.md",
    "ipsum.md"
  ],
}
```

Each section starts on a new page.

# Reference

The above tutorial should give you a pretty good idea of how to use EBREW; the following sections provide a comprehensive reference of the command line interface, the manifest format, and EBREW's Markdown extensions.

## The `ebrew` command

#### `ebrew init`
Takes no options. Runs an interactive wizard for creating a new `book.json` manifest.

#### <code>ebrew [output=<em>title</em>.epub] [input=book.json]</code>
Generates an EPUB file from the given manifest

## The manifest format

| key | description |
|----:|:------------|
| `"contents"` | A filename or list of filenames corresponding to sections in the book. Required. |
| `"title"` | The book's title. Default: `"Untitled"`. |
| `"subtitle"` | The book's subtitle, usually displayed below or beside the title, separated from it by a colon. Default: `""`, i.e., no subtitle. |
| `"language"` | An RFC 3066 language identifier indicating the primary language of the book's content. Default: `"en"`. |
| `"authors"` | A string or list of strings indicating the authors of the book. Default: `""` or `[]`, i.e., no authors. |
| `"publisher"` | The book's publisher. Default: `""`, i.e., no publisher. |
| `"rights"` | A statement about rights. Default: <code>"Copyright ©<em>year</em> <em>authors</em>"</code>. |
| `"date"` | The date of publication of the book. Default: today. |
| `"created"` | The date on which the book was createds. Default: today. |
| `"copyrighted"` | The copyright date of the book. Default: today. |
| `"tocDepth"` | The maximum nesting level of the generated table of contents. Default: `6`, i.e., no limit. |
