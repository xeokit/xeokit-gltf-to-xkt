'use strict';
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const { glTFToXKT } = require('../src/index.js');
const path = require('path');


const testFiles = {
  "../models/gltf/OTCConferenceCenter/scene.gltf":"../models/xkt/OTCConferenceCenter.xkt",
  "../models/gltf/schependomlaan/scene.gltf":"../models/xkt/schependomlaan.xkt",
  "../models/gltf/duplex/scene.gltf": "../models/xkt/duplex.xkt"
}

async function convert() {
  for (const [input, output] of Object.entries(testFiles)) {
    const absolute_input = path.join(__dirname, input);
    const absolute_output = path.join(__dirname, output);
    console.log(`[INFO] Converting glTF ${absolute_input} to ${absolute_output}`);
    const gltf = await readFileAsync(absolute_input);
    const xkt = glTFToXKT(gltf);
    await writeFileAsync(absolute_output, xkt);
  }
};

convert();
