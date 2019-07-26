# xeokit's gltf2xkt

## Contents

 - [Overview](#overview)
 - [Credits](#credits)
 - [Usage](#usage)
 - [Work Remaining](#work-remaining)
  
## Overview
**xeokit-gltf-to-xkt** converts models from glTF 2.0 to 
[xeokit](http://xeokit.io)'s optimized ````.xkt```` format.

An ````.xkt```` file is a single BLOB containing a model, compressed using 
geometry quantization and zlib. 
See the [XKT Format](https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format) 
specification for a more detailed description of the ````.xkt```` format.


Once you have ````.xkt```` files, you can load them into your viewer using 
[XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html), 
which is the most efficient way to load high-detail models into xeokit.
 
Click on the screenshot below for a live demo of the XKTLoaderPlugin.

<a href="https://xeokit.github.io/xeokit-sdk/examples/#loading_XKT_OTCConferenceCenter">
    <img src="http://xeokit.io/img/docs/XKTLoaderPlugin/XKTLoaderPlugin.png">
</a>
 
[[Run this example](https://xeokit.github.io/xeokit-sdk/examples/#loading_XKT_OTCConferenceCenter)]

## Usage

### CLI

Install locally or globally from `npm`.

```bash
$ npm install gltf2xkt -g
```

```bash
$ gltf2xkt --help

Usage: gltf2xkt [options]

Options:
  -v, --version        output the version number
  -s, --source [file]  The path to the source gltf file.
  -o, --output [file]  The path to the target xkt file.
  -h, --help           output usage information
```

### Programmatically

```javascript
const Converter = require('gltf2xkt');

const gltfPath = '../bimspot/_sample-data/scene.gltf';
const xktPath = 'scene.xkt';
const gltf2xkt = new Converter(gltfPath, xktPath);

gltf2xkt
  .convert()
  .then(() => {
    console.log('Success');
  })
  .catch((error) => {
    console.error('Something went wrong:', error);
  });
```

## Development

```bash
// Clone the repo
$ git clone https://github.com/xeokit/xeokit-gltf-to-xkt
$ cd xeokit-gltf-to-xkt

// Install the dependencies
$ npm install

// Link for command line usage
$ npm link

// Use global symlink for testing
$ gltf2xkt -s /path/to/scene.gltf -o /path/to/scene.xkt
```

See `.eslint` and `.prettierrc` for code style guide.

## Credits

The ````xeokit-gltf-to-xkt```` tool and the 
[XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html) 
are based on prototypes by [Toni Marti](https://github.com/tmarti) at [uniZite](https://www.unizite.com/login). Find the original discussion around those prototypes [here](https://github.com/xeokit/xeokit-sdk/issues/48#).

## Work Remaining

* [ ] Publish to `npm`.
* [ ] At present, ````xeokit-gltf-to-xkt```` only works with glTF 2.0 models that
have base-64 geometry buffers embedded within the glTF JSON.
