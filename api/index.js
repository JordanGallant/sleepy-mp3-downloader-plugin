// Server-side example (Node.js)
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/convert-audio', upload.single('audio'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = `uploads/${Date.now()}_320kbps.mp3`;

  ffmpeg(inputPath)
    .audioBitrate(320)
    .save(outputPath)
    .on('end', () => {
      res.download(outputPath, (err) => {
        if (err) {
          console.error('Error during file download:', err);
        }
        // Clean up uploaded file after sending it
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', (err) => {
      console.error('Error during conversion:', err);
      res.status(500).send('Error during conversion');
    });
});

app.listen(3000, () => console.log('Server started on port 3000'));
