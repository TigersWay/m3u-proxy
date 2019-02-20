'use strict';

const fs = require('fs');
const path = require('path');

const get = require('simple-get');
const byline = require('byline');

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

const M3UFilePrefix = /^#EXTM3U/;
const M3UPrefix = /^#EXTINF/;
const M3UFields = /^#EXTINF:-?\d+(?: ([\w-]*)="(.*?)")(?: ([\w-]*)="(.*?)")?(?: ([\w-]*)="(.*?)")?(?: ([\w-]*)="(.*?)")?(?: ([\w-]*)="(.*?)")?.*,(.*)/;

const processM3U = (source) => {
  return new Promise((resolve, reject) => {
    debug(`M3U-Process: ${source.name}`);
    // Preparation
    if (source.filters) {
      for (let i = 0; i < source.filters.length; i++) source.filters[i].regex = new RegExp(source.filters[i].regex, 'i');
    }
    if (source.transformations) {
      for (let i = 0; i < source.transformations.length; i++) source.transformations[i].regex = new RegExp(source.transformations[i].regex, 'i');
    }
    // Loop
    const stream = byline.createStream(fs.createReadStream(`./imports/${source.name}.m3u`, { encoding: 'utf8' }));
    const streams = [];
    let fields = {};
    stream.on('data', (line) => {
      // byline skips empty lines
      if (line.match(M3UFilePrefix)) {
        // First line
      } else if (line.match(M3UPrefix)) {
        // We get fields
        let matches = line.match(M3UFields);
        for (let i = 1; i < 8; i += 2) {
          if (matches[i]) fields[matches[i]] = matches[i + 1];
        }
      } else {
        // And stream URL
        fields.stream = line;
        // Now let's check filters
        let valid = true;
        if (source.filters) {
          for (let i = 0; i < source.filters.length; i++) {
            if (!source.filters[i].regex.test(fields[source.filters[i].field])) {
              valid = false;
              break;
            }
          }
        }
        // Do we need to apply transformations?
        if (valid && source.transformations) {
          for (let i = 0; i < source.transformations.length; i++) {
            fields[source.transformations[i].field] = fields[source.transformations[i].field].replace(source.transformations[i].regex, source.transformations[i].substitution);
          }
        }
        if (valid) streams.push(fields);
        fields = {};
      }
    });
    stream.on('end', () => {
      debug(`M3U-Process: ${source.name}`);
      resolve(streams);
    });
  });
};

const exportM3U = (source, streams) => {
  return new Promise((resolve, reject) => {
    debug(`M3U-Write: ${source.name}`);
    if (!fs.existsSync('exports')) fs.mkdirSync('exports');
    const file = fs.createWriteStream(`./exports/${source.name}.m3u`);
    file.write('#EXTM3U\n');
    streams.forEach(stream => {
      file.write(`#EXTINF:-1 tvg-id="${stream['tvg-id']}" tvg-name="${stream['tvg-name']}" tvg-logo="${stream['tvg-logo']}" group-title="${stream['group-title']}",${stream['tvg-name']}\n`);
      file.write(`${stream.stream}\n`);
    });
    file.end();
    debug(`M3U-Write: ${source.name}`);
    resolve();
  });
};

const processSource = async (source) => {
  debug(`Source: ${source.name}`);

  await getFile(source.m3u, `./imports/${source.name}.m3u`);
  let streams = await processM3U(source);
  await exportM3U(source, streams);

  debug(`Source: ${source.name}`);
};

(async () => {
  const sources = require('./config.json');
  for (const source of sources) {
    await processSource(source);
  }
})();
