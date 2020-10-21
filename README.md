# xeokit-gltf-to-xkt

[![npm version](https://badge.fury.io/js/%40xeokit%2Fxeokit-gltf-to-xkt.svg)](https://badge.fury.io/js/%40xeokit%2Fxeokit-gltf-to-xkt)

## Contents

 - [Overview](#overview)
 - [Usage](#usage)
 - [Credits](#credits)
  
## Overview

**xeokit-gltf-to-xkt** converts models from glTF 2.0 to 
[xeokit](http://xeokit.io)'s optimized ````.xkt```` format.

An ````.xkt```` file is a binary file that contains a single 3D model with full-precision geometry, compressed using quantization, 
oct-encoding and zlib. 

See the [XKT Format](https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format) specification for a detailed description of the ````.xkt```` format.

See [Creating Files for Offline BIM](https://github.com/xeokit/xeokit-sdk/wiki/Creating-Files-for-Offline-BIM) for instructions on converting IFC, DAE and glTF models to ````.xkt````.

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

```
$ npm i @xeokit/xeokit-gltf-to-xkt
$ ./gltf2xkt -s scene.gltf -o scene.xkt
```

```
$ gltf2xkt --help

Usage: gltf2xkt [options]

Options:
  -v, --version          output the version number
  -s, --source [file]    path to the source glTF file
  -o, --output [file]    path to the target xkt file
  -f  --format [number]  XKT format to write
  -h, --help             output usage information

Supported XKT Formats:
  1 - Oct-encoded normals; Quantized positions; No geometry reuse;
  3 - Geometry reuse; Oct-encoded normals; Quantized positions; (DEFAULT)
  6 - Full-precision geometry; Geometry reuse; Oct-encoded normals; Quantized positions;
```

### Programmatically

```javascript
const fs = require('fs').promises;
const {converters, getBasePath} = require('@xeokit/xeokit-gltf-to-xkt');

const converter = converters[6]; // the key is the version number

async function main() {
  const gltfContent = await fs.readFile('../files/my_model.gltf');
  const gltfBasePath = getBasePath('../files/my_model.gltf'); // returns ../files/

  async function getAttachment(uri, parsingContext) {
    // This method we'll be called if the GLTF has an external resource. You may want to fetch them from disk or over network.
    // uri is the URI defined in the GLTF, parsingContext is some context on the current parse
    // If you know your gltf files don't use any eternal resource, you can call converter.convert(gltfContent) without this function.
    return fs.readFile(gltfBasePath + uri);
  }

  const xktModel = await converter.convert(gltfContent, getAttachment);

  await fs.writeFile('../files/my_model.xkt', xktModel);
}

main();
```
 
## Development

```
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

- The ````xeokit-gltf-to-xkt```` tool and the 
[XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html)
are based on prototypes by [Toni Marti](https://github.com/tmarti) at [uniZite](https://www.unizite.com/login). Find the original discussion around those prototypes [here](https://github.com/xeokit/xeokit-sdk/issues/48#).
- Thanks to [Adam Eri](https://github.com/eriadam) at [BIMSpot](https://bimspot.io/) for converting ````xeokit-gltf-to-xkt```` to work as a CLI tool.
