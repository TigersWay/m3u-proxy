# m3u-proxy

Download, process/simplify and serve M3U &amp; EPG files from your IPTV provider(s).

## Configuration

```json
{
  "importFolder": "./imports",
  "exportFolder": "/var/www/html/iptv",
  "minutesBetweenImports": "360",
  "sources": [
    {
      "name": "MyProvider",
      "m3u": "http://url-of-my-stream-provider/streams.m3u",
      "models": [
        {
          "name": "",
          "filters": [
            {
              "field": "group-title",
              "regex": "UK .*|USA .*"
            }
          ],
          "transformations": [
            {
              "field": "group-title",
              "regex": "(UK|USA).*",
              "substitution": "$1"
            },
            {
              "field": "tvg-name",
              "regex": "(.*?) *: *(.*)",
              "substitution": "$1: $2"
            }
          ]
        }
      ],
      "epg": "http://url-of-my-guide-provider/xmltv.xml"
    }
  ]
}

```
- **importFolder**: Destination folder for all imports.
- **exportFolder**: Destination folder for all exports.
- **minutesBetweenImports**: Not yet available.
- **name**: Prefix for export filenames: downloadable files are
<name\><model\>.m3u & <name\>.xml.
- **m3u**: Original url for the M3U file.
- **epg**: Original url the the guide/xmltv file.
- **filters**: Combined, they Allow to select only some of the channels.
- **transformations**: Each of them will transform a field of the channel details.

## Running
`node .\m3u-proxy.js`

### Arguments (v0.4.0)
You can specify a custom config.json file location by using `-c` or `--config` command line arguments

`node .\m3u-proxy.js -c ~/.m3u-proxy/config.json`

`node .\m3u-proxy.js --config ~/.m3u-proxy/config.json`
