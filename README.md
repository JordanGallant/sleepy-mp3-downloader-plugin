# SoundCloud Downloader to MP3

## How it works

This project is a browser extension that injects a music downloader directly into your browser for **SoundCloud**, **Spotify**, and **Bandcamp**. It uses a Dockerized audio converter powered by `ffmpeg` to convert tracks to high-quality MP3 files at **320kbps** bitrate. The extension also supports **batch downloading** with ZIP file packaging and keeps a log of **recent downloads** for easy access.


Most MP3 downloaders are tedious to use and often return low-quality audio — this tool is designed to solve that.

## Prerequisites
Node v20*

## How to use

1. ```bash
   git clone https://github.com/JordanGallant/soundcloud-downloader-plugin.git
   ```
2. ```bash
    cd soundcloud-downloader-plugin/plugin
   ```
3. ```bash
   npm install
   ```
4. ```bash
    npx vite build
    ```
5.  Open your browser extensions page:
   - In Brave (or Chrome): `brave://extensions/` or `chrome://extensions/`
5. In the top-right corner, enable **Developer mode**.
6. Click **Load unpacked** and select the location of this repo.
7. Visit [SoundCloud](https://soundcloud.com), and the plugin will automatically inject into the browser.

