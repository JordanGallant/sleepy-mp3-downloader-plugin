const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const youtubedl = require('youtube-dl-exec');

dotenv.config();
api = process.env.YOUTUBE_API

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json()); //handles requests json bodies
app.use(express.text());
// Basic logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// search endpoint to YouTube -> now returns videoId to client
app.post('/search', async (req, res) => {
    const query = req.body;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&key=${api}&maxResults=10`;
    try {
        console.log("Sending request to YouTube API");
        const response = await axios.get(url);

        // checks video is not a music video -> unwanted/dead audio
        let videoId, title;
        for (const item of response.data.items) {
            if (item.id.videoId && item.snippet.title) {
                const currentTitle = item.snippet.title;
                if (!currentTitle.toLowerCase().includes('official') && !currentTitle.toLowerCase().includes('show') && !currentTitle.toLowerCase().includes('stage')&& !currentTitle.toLowerCase().includes('remix')) {
                    videoId = item.id.videoId;
                    console.log("vidoe", videoId)
                    break;
                }
            }
        }

        // return the video Id and title to the client
        res.status(200).json({
            videoId: videoId
        });
    } catch (error) {
        console.error('❌ YouTube API error:', error.message);
        res.status(500).json({ error: 'Failed to fetch YouTube results' });
    }
});


const upload = multer({ dest: 'uploads/' });
const progressClients = new Map(); // key: id, value: response

// SSE endpoint to stream progress updates
app.get('/progress', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).send("Missing id");

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();

    progressClients.set(id, res);

    req.on('close', () => {
        progressClients.delete(id);
    });
});

const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

//receives video id -> download the audio from youtube 
app.post('/download', async (req, res) => {
    const { id } = req.body;
    const url = `https://www.youtube.com/watch?v=${id}`;
    const outputPath = path.join(__dirname, 'downloads', `${id}.mp3`);
    const convertedPath = path.join(__dirname, 'downloads', `${id}_320kbps.mp3`);
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    
    try {
      // Check if cookies file exists
      if (!fs.existsSync(cookiesPath)) {
        console.log('Creating cookies file from browser...');
        try {
          // First create a cookies file from browser if it doesn't exist
          await youtubedl('https://www.youtube.com/', {
            dumpSingleJson: true,
            skipDownload: true,
            cookiesFromBrowser: 'chrome',
            cookies: cookiesPath
          });
        } catch (cookieError) {
          console.log('Cookie extraction warning:', cookieError.message);
          // Continue anyway as we might have partial cookies
        }
      }
      
      // Download audio from YouTube with multiple authentication methods
      await youtubedl(url, {
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        cookies: cookiesPath, // spoofed real auth cookies that expire 1st jan 2030 (LOL -> cookies.txt)
        geoBypass: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        addHeader: [
          'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language:en-US,en;q=0.5',
          'DNT:1',
          'Connection:keep-alive'
        ],
        retries: 3,
        socketTimeout: 30
      });

      // Convert bitrate to 320kbps using fluent-ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(outputPath)
          .audioBitrate(320)
          .format('mp3')
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
          })
          .on('end', () => {
            console.log('Bitrate conversion completed');
            resolve();
          })
          .save(convertedPath);
      });
  
      // Set headers for streaming the file
      res.setHeader('Content-Disposition', `attachment; filename="${id}_320kbps.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');
  
      // Create a read stream and pipe it to the response
      const fileStream = fs.createReadStream(convertedPath);
      fileStream.pipe(res);
  
      // Delete the files after sending
      fileStream.on('end', () => {
        // Delete both original and converted files
        fs.unlink(outputPath, (err) => {
          if (err) console.error('Error deleting original file:', err);
        });
        fs.unlink(convertedPath, (err) => {
          if (err) console.error('Error deleting converted file:', err);
        });
      });
    } catch (error) {
      console.error('Download error:', error);
      
      // Clean up any files that might have been created before the error
      [outputPath, convertedPath].forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, err => {
            if (err) console.error(`Error cleaning up ${filePath}:`, err);
          });
        }
      });
      
      // error handling -> youtube HATES bots but bad at stopping them
      if (error.stderr && error.stderr.includes('confirm you\'re not a bot')) {
        res.status(429).json({ 
          error: 'YouTube has detected automated access. Please try again later.',
          details: 'The service is temporarily being rate-limited by YouTube.' 
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to download or convert audio',
          details: error.message 
        });
      }
    }
});
  
// audio conversion endpoint - recieves audio data
app.post('/convert-audio', upload.single('audio'), (req, res) => {
    const id = req.query.id;
    const audioFile = req.file;

    if (!audioFile) return res.status(400).send('No file uploaded');

    console.log('Received audio file:', audioFile);

    const inputPath = req.file.path;
    const outputPath = `uploads/${Date.now()}_320kbps.mp3`;

    ffmpeg(inputPath)
        .audioBitrate(320) //converts to 320kbps
        .on('start', (commandLine) => {
            console.log('[FFMPEG START]', commandLine);
        })
        .on('progress', (progress) => {
            const client = progressClients.get(id);
            if (client) {
                const message = JSON.stringify({
                    percent: progress.percent?.toFixed(2),
                });
                client.write(`data: ${message}\n\n`);
            }
        })
        .on('stderr', (stderrLine) => {
            console.log('[FFMPEG STDERR]', stderrLine);
        })
        .on('end', () => {
            console.log('[FFMPEG END] Conversion finished.');

            // Close SSE stream and notify client
            const client = progressClients.get(id);
            if (client) {
                client.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                client.end();
                progressClients.delete(id);
            }

            res.download(outputPath, (err) => {
                if (err) {
                    console.error('Error during file download:', err);
                    res.status(500).send('Error during file download');
                }

                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
            });
        })
        .on('error', (err) => {
            console.error('[FFMPEG ERROR]', err.message);
            res.status(500).send('Error during conversion');

            const client = progressClients.get(id);
            if (client) {
                client.write(`data: ${JSON.stringify({ error: true })}\n\n`);
                client.end();
                progressClients.delete(id);
            }

            fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
            fs.existsSync(outputPath) && fs.unlinkSync(outputPath);
        })
        .save(outputPath);
});




// starts server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
