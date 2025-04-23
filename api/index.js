const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({
    origin: '*',
}));

// Basic logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const upload = multer({ dest: 'uploads/' }); // This stores the file temporarily
let progressClients = [];

// Endpoint to store progress of download
app.get('/progress', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();

    progressClients.push(res);

    req.on('close', () => {
        progressClients = progressClients.filter(c => c !== res);
    });
});

app.post('/convert-audio', upload.single('audio'), (req, res) => {
    const audioFile = req.file;
    console.log('Received audio file:', audioFile);

    const inputPath = req.file.path;
    const outputPath = `uploads/${Date.now()}_320kbps.mp3`;

    ffmpeg(inputPath)
        .audioBitrate(320)
        .on('start', (commandLine) => {
            console.log('[FFMPEG START]', commandLine);
        })
        .on('progress', (progress) => {
            console.log(`[FFMPEG PROGRESS] ${progress.percent?.toFixed(2) || 0}% done`);
            const message = JSON.stringify({
                percent: progress.percent?.toFixed(2),
            });
            progressClients.forEach(client =>
                client.write(`data: ${message}\n\n`)
            );
        })
        .on('stderr', (stderrLine) => {
            console.log('[FFMPEG STDERR]', stderrLine);
        })
        .on('end', () => {
            console.log('[FFMPEG END] Conversion finished.');
            // Send the file for download after conversion
            res.download(outputPath, (err) => {
                if (err) {
                    console.error('Error during file download:', err);
                    res.status(500).send('Error during file download');
                }
                // Clean up uploaded and output files after sending
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
            });
        })
        .on('error', (err) => {
            console.error('[FFMPEG ERROR]', err.message);
            res.status(500).send('Error during conversion');
        })
        .save(outputPath);
});

app.listen(3000, () => {
    console.log('Server is running');
});
