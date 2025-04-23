# SoundCloud Downloader to MP3

## How it works

This project is a browser extension that injects a SoundCloud downloader directly into your browser. It uses a Dockerized audio converter powered by `ffmpeg` to convert tracks to high-quality MP3 files at **320kbps** bitrate.

Most MP3 downloaders are tedious to use and often return low-quality audio — this tool is designed to solve that.

## How to use

1. ```bash
   git clone https://github.com/JordanGallant/soundcloud-downloader-plugin.git
   ```
2. ```bash
   npx bite build
   ```
3. Open your browser extensions page:
   - In Brave (or Chrome): `brave://extensions/` or `chrome://extensions/`
4. In the top-right corner, enable **Developer mode**.
5. Click **Load unpacked** and select the location of this repo.
6. Visit [SoundCloud](https://soundcloud.com), and the plugin will automatically inject into the browser.

### Development 

To build the extension, run:

```bash
npx vite build
