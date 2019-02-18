'use strict';

const fs = require('fs');
const path = require('path');
const get = require('simple-get');

const debug = require('debug')('m3u-proxy');


const getFile = (url, filename) => {
  debug(`getFile: ${filename}`);
  return new Promise((resolve, reject) => {
    // Prepare destination
    const dirname = path.dirname(filename);
    if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
    const file = fs.createWriteStream(filename + '.tmp');
    // and download
    get(url, (error, response) => {
      if (error) {
        fs.unlinkSync(filename + '.tmp');
        reject(new Error(`[${response.statusCode}] Failed to load resource: ${url}`));
      }
      // pipe received data
      response.pipe(file);
      // and close
      response.on('close', () => {
        if (fs.existsSync(filename)) fs.unlinkSync(filename);
        fs.renameSync(filename + '.tmp', filename);
        debug(`getFile: ${filename}`);
        resolve();
      });
    });
  });
};


const processSource = async (source) => {
  debug(`Source: ${source.name}`);

  await getFile(source.m3u, `./imports/${source.name}.m3u`);

  debug(`Source: ${source.name}`);
};

(async () => {
  const sources = require('./config.json');
  for (const source of sources) {
    await processSource(source);
  }
})();
