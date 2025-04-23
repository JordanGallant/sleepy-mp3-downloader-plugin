# SoundCloud Downloader to MP3

## How it works

This project is a browser extension that injects a SoundCloud downloader directly into your browser. It uses a Dockerized audio converter powered by `ffmpeg` to convert tracks to high-quality MP3 files at **320kbps** bitrate.

Most MP3 downloaders are tedious to use and often return low-quality audio — this tool is designed to solve that.

## How to use

1.git clone https://github.com/JordanGallant/soundcloud-downloader-plugin.git
2. Open your browser extensions page:
   - In Brave (or Chrome): `brave://extensions/` or `chrome://extensions/`
3. In the top-right corner, enable **Developer mode**.
4. Click **Load unpacked** and select the location of this repo.
5. Visit [SoundCloud](https://soundcloud.com), and the plugin will automatically inject into the browser.

### Build Command

To build the extension, run:

```bash
npx vite build
