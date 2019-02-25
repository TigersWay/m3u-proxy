'use strict';

const fs = require('fs');
const path = require('path');

const get = require('simple-get');
const byline = require('byline');
const flow = require('xml-flow');

const debug = require('debug')('m3u-proxy');

const config = require('./config.json');


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
      response.on('end', () => {
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
    const stream = byline.createStream(fs.createReadStream(`${config.importFolder}/${source.name}.m3u`, { encoding: 'utf8' }));
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
        if (!fields['tvg-name']) fields['tvg-name'] = matches[11].trim();
      } else {
        // And stream URL
        fields.stream = line;
        // Now let's check filters
        let valid;
        if (!source.filters) {
          valid = true;
        } else {
          valid = false;
          for (let i = 0; i < source.filters.length; i++) {
            if (source.filters[i].regex.test(fields[source.filters[i].field])) {
              valid = true;
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
    // Prepare destination
    if (!fs.existsSync(`${config.exportFolder}`)) fs.mkdirSync(`${config.exportFolder}`, { recursive: true });
    const file = fs.createWriteStream(`${config.exportFolder}/${source.name}.m3u`);
    // And export
    file.write('#EXTM3U\n');
    streams.forEach(stream => {
      file.write(`#EXTINF:-1`);
      if (stream['tvg-id']) file.write(` tvg-id="${stream['tvg-id']}"`);
      if (stream['tvg-name']) file.write(` tvg-name="${stream['tvg-name']}"`);
      if (stream['tvg-logo']) file.write(` tvg-logo="${stream['tvg-logo']}"`);
      file.write(` group-title="${stream['group-title']}",${stream['tvg-name']}\n`);
      file.write(`${stream.stream}\n`);
    });
    file.end();
    debug(`M3U-Write: ${source.name}`);
    resolve();
  });
};

const processEPG = (source, streams) => {
  return new Promise((resolve, reject) => {
    debug(`EPG-Process: ${source.name}`);
    // Always M3U before EPG, so no need to check export folder
    const xmlStream = flow(fs.createReadStream(`${config.importFolder}/${source.name}.xml`));
    const epg = fs.createWriteStream(`${config.exportFolder}/${source.name}.xml`);
    //
    epg.write('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE tv SYSTEM "xmltv.dtd">\n<tv>\n');
    xmlStream.on('tag:channel', (node) => {
      if (streams.indexOf(node.$attrs.id) >= 0) {
        epg.write(flow.toXml(node));
        epg.write('\n');
      }
    });
    xmlStream.on('tag:programme', (node) => {
      if (streams.indexOf(node.$attrs.channel) >= 0) {
        epg.write(flow.toXml(node));
        epg.write('\n');
      }
    });
    xmlStream.on('end', () => {
      epg.write('</tv>');
      debug(`EPG-Process: ${source.name}`);
      resolve();
    });
  });
};

const processSource = async (source) => {
  debug(`Source: ${source.name}`);

  await getFile(source.m3u, `${config.importFolder}/${source.name}.m3u`);
  let streams = await processM3U(source);
  await exportM3U(source, streams);

  if (source.epg) {
    await getFile(source.epg, `${config.importFolder}/${source.name}.xml`);
    await processEPG(source, streams.map(x => x['tvg-id']));
  }

  debug(`Source: ${source.name}`);
};

(async () => {
  for (const source of config.sources) {
    await processSource(source);
  }
})();
