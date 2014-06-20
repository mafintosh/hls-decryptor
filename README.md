# hls-decryptor

hls proxy that will decrypt segment files of another hls playlist

```
npm install -g hls-decryptor
```

## Usage

Simply pass a link to http live streaming server

```
hls-decryptor http://some-hls-server.com/index.m3u8
```

If the playlist contains encrypted segments hls-decryptor will decrypt them for you.
I needed this to make encrypted streams work on my raspberry pi.

## License

MIT