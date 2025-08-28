const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const { error } = require('console');
const { stdout, stderr } = require('process');


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

//downloads image from BANDCAMP
app.post('/download-image', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        console.log("Processing image URL:", imageUrl);
        
        const imageBuffer = await getImageBlob(imageUrl);
        
        // Detect mime type (assuming jpeg for now)
        const mimeType = 'image/jpeg'; // Ideally, detect dynamically
        
        // Convert the image buffer to Base64
        const base64Image = imageBuffer.toString('base64');
        
        // Build the data URL
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        
        // Send it back in JSON
        res.json({ imageBase64: dataUrl });
    } catch (error) {
        console.error('Error processing image download:', error);
        res.status(500).json({ error: 'Error processing image download' });
    }
});
// dynamically gets client ID -> ensures even when revoked it works
app.post('/get-soundcloud-clientid', async (req, res) => {
    exec('curl -s https://a-v2.sndcdn.com/assets/0-c78a5fdb.js | grep -o "client_id=[a-zA-Z0-9]*"', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return res.status(500).send('Error fetching SoundCloud client ID');
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return res.status(500).send('Error fetching SoundCloud client ID');
        }

        res.send(stdout.trim());
    });
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

            // close SSE stream and notify client
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

const getImageBlob = async (url) => {
    const response = await fetch(url);
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    return Buffer.from(arrayBuffer); // Turn it into a Node.js Buffer
};

// starts server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
