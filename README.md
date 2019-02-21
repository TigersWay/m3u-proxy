# m3u-proxy

Download, process/simplify and serve M3U &amp; EPG files from your IPTV provider(s).

## Configuration

```json
[
  {
    "name": "MyProvider",
    "m3u": "http://url-of-my-stream-provider/streams.m3u",
    "epg": "http://url-of-my-guide-provider/xmltv.xml",
    "filters": [
      {
        "field": "group-title",
        "regex": "UK.*|USA.*"
      }
    ],
    "transformations": [
      {
        "field": "tvg-name",
        "regex": "(.*?) *: *(.*)",
        "substitution": "$1: $2"
      }
    ]
  }
]
```
### name
Filename without extension, downloadable files would then be <name>.m3u & <name>.xml

### m3u
Original url for the M3U file

### epg
Original url the the guide/xmltv file

### filters

### transformations
