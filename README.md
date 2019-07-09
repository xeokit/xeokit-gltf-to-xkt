# xeokit-gltf-to-xkt

## Contents
 - [Overview](#overview)
 - [Credits](#credits)
 - [Usage](#usage)
 - [Work Remaining](#work-remaining)
  
## Overview
**xeokit-gltf-to-xkt** converts models from glTF 2.0 to [xeokit](http://xeokit.io)'s optimized ````.xkt```` format.

An ````.xkt```` file is a single BLOB containing a model, compressed using geometry quantization and pako.


Once you have ````.xkt```` files, you can load them into your viewer using  [XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html), which is the most 
efficient way to load high-detail models into xeokit.
 

Click the screenshot below for a demo of the XKTLoaderPlugin.

<a href="https://xeokit.github.io/xeokit-sdk/examples/#loading_XKT_OTCConferenceCenter"><img src="http://xeokit.io/img/docs/XKTLoaderPlugin/XKTLoaderPlugin.png"></a>
 
[[Run this example](https://xeokit.github.io/xeokit-sdk/examples/#loading_XKT_OTCConferenceCenter)]

## Credits

The ````xeokit-gltf-to-xkt```` tool and the  [XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html) are based on prototypes by [Toni Marti](https://github.com/tmarti) at [uniZite](https://www.unizite.com/login). Find the original discussion around those prototypes [here](https://github.com/xeokit/xeokit-sdk/issues/48#).

## Usage

First, clone this repository and install dependencies:

````
git clone https://github.com/xeokit/xeokit-gltf-to-xkt.git
cd xeokit-gltf-to-xkt.git
npm install
````

Then put your glTF files in the ````./models/glTF```` directory. 

For demo purposes, we already have these models:

````
models
└── gltf
    ├── duplex
    │   └── scene.gltf
    ├── OTCConferenceCenter
    │   └── scene.gltf
    └── schependomlaan
        └── scene.gltf
````

Next, add ````glTFToXKT()```` calls to ````./src/converter.js````, to convert the models:


````javascript
import {glTFToXKT} from "./glTFToXKT/glTFToXKT.js";

glTFToXKT("./models/gltf/OTCConferenceCenter/scene.gltf", "./models/xkt/OTCConferenceCenter.xkt");
glTFToXKT("./models/gltf/schependomlaan/scene.gltf", "./models/xkt/schependomlaan.xkt");
glTFToXKT("./models/gltf/duplex/scene.gltf", "./models/xkt/duplex.xkt");
````

Now run the tool from the project root directory:

````
node start.js
````

That's going to call ````./converter.js````, which converts our models.

In the console, you should see:

````
[INFO] Converting glTF ./models/gltf/OTCConferenceCenter/scene.gltf to ./models/xkt/OTCConferenceCenter.xkt
arrayBuffer takes 8313.915 kB
[INFO] Converting glTF ./models/gltf/schependomlaan/scene.gltf to ./models/xkt/schependomlaan.xkt
arrayBuffer takes 1679.650 kB
[INFO] Converting glTF ./models/gltf/duplex/scene.gltf to ./models/xkt/duplex.xkt
arrayBuffer takes 199.306 kB
````

Once converted, our ````.xkt```` models will appear in the ````models/xkt```` directory:

````
models
├── gltf
│   ├── duplex
│   │   └── scene.gltf
│   ├── gearbox
│   │   └── scene.gltf
│   ├── OTCConferenceCenter
│   │   └── scene.gltf
│   └── schependomlaan
│       └── scene.gltf
└── xkt
    ├── duplex.xkt
    ├── OTCConferenceCenter.xkt
    └── schependomlaan.xkt

````

Finally, use the [XKTLoaderPlugin](https://xeokit.github.io/xeokit-sdk/docs/class/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin.js~XKTLoaderPlugin.html) to load the ````.xkt```` models into your xeokit viewer:

````javascript
const viewer = new Viewer({
      canvasId: "myCanvas",
      transparent: true
});

viewer.camera.eye = [-2.56, 8.38, 8.27];
viewer.camera.look = [13.44, 3.31, -14.83];
viewer.camera.up = [0.10, 0.98, -0.14];

const xktLoader = new XKTLoaderPlugin(viewer);

const model = xktLoader.load({ 
    id: "myModel",
    src: "./models/xkt/schependomlaan/schependomlaan.xkt",
    metaModelSrc: "./metaModels/schependomlaan/metaModel.json",
    edges: true
});
````

## Work Remaining

At present, ````xeokit-gltf-to-xkt```` only works with glTF 2.0 models that have base-64 geometry buffers embedded within the glTF JSON.  
