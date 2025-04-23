const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

// Basic logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
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
