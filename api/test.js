const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

app.post('/search', async (req, res) => {
    const query = req.body.query; // Assuming query is sent as { query: "search term" }
    
    try {
        console.log("Executing YouTube search via curl for query:", query);
        
        // Execute the curl command
        const curlCommand = `curl -s "https://www.youtube.com/results?search_query=${query}" \\
          -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \\
          -H "Accept-Language: en-US,en;q=0.9" | \\
          grep -o '"videoId":"[^"]*"' | \\
          head -1 | \\
          cut -d'"' -f4`;
        
        const { stdout, stderr } = await execPromise(curlCommand);
        
        if (stderr) {
            console.error('❌ Curl command error:', stderr);
            return res.status(500).json({ error: 'Failed to execute search' });
        }
        
        const videoId = stdout.trim();
        
        if (!videoId) {
            return res.status(404).json({ error: 'No video found' });
        }
        
        console.log("Found video ID:", videoId);
        
        // Return the video ID to the client
        res.status(200).json({
            videoId: videoId
        });
        
    } catch (error) {
        console.error('❌ Search error:', error.message);
        res.status(500).json({ error: 'Failed to fetch YouTube results' });
    }
});