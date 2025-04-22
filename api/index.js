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

const upload = multer({ dest: 'uploads/' }); // This stores the file temporarily

app.post('/convert-audio', upload.single('audio'), (req, res) => {
    const audioFile = req.file;
    console.log('Received audio file:', audioFile);

    const inputPath = req.file.path;
    const outputPath = `uploads/${Date.now()}_320kbps.mp3`;

    ffmpeg(inputPath)
        .audioBitrate(320)
        .save(outputPath)
        .on('end', () => {
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
            console.error('Error during conversion:', err);
            res.status(500).send('Error during conversion');
        });
});

app.listen(3000, () => {
    console.log('Server is running');
});
