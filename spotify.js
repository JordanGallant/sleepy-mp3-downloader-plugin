const createDownloadAllSpotifyButton = () => {
    const btn = document.createElement('button');
    btn.className = 'spotify-all-button';
    btn.style.background = '#1DB954';
    btn.style.marginLeft = '10px';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';
    btn.style.textAlign = 'center';
    btn.style.padding = '5px 5px';
    btn.innerText = 'Download All';
    btn.onclick = async () => {
        btn.innerText = 'Processing...';

        // Find track rows of all the tracks 
        const trackRows = document.querySelectorAll('[data-testid="tracklist-row"]');

        let count = trackRows.length;
        console.log(`Found ${count} tracks to download`);

        if (count === 0) {
            btn.innerText = 'No tracks found';
            setTimeout(() => {
                btn.innerText = 'All';
                toggleButtons(false);
            }, 2000);
            return;
        }

        // Initialize JSZIP
        const zip = new JSZip();

        // loop
        for (const row of trackRows) {
            btn.innerText = `(${count})`;
            count -= 1;

            // Find the title element
            const titleElement = row.querySelector('[data-testid="internal-track-link"] div');
            let artistElements = row.querySelectorAll('.UudGCx16EmBkuFPllvss a');
            let imageElement = row.querySelector('img.mMx2LUixlnN_Fu45JpFB');
            let smallUrl;
            let albumElement = row.querySelector('a.standalone-ellipsis-one-line');

            // Checks if image is in the track row otherwise gets image from page
            if (!imageElement) {
                imageElement = document.querySelector('img.mMx2LUixlnN_Fu45JpFB.CmkY1Ag0tJDfnFXbGgju._EShSNaBK1wUIaZQFJJQ');
                smallUrl = imageElement ? imageElement.src : defaultImageURL;
            } else {
                smallUrl = imageElement.src;
            }

            // Checks if album name is in the track row otherwise gets it from document
            if (!albumElement) {
                albumElement = document.querySelector('h1.e-9812-text.encore-text-headline-large.encore-internal-color-text-base');
            }

            const artists = [];

            artistElements.forEach(link => {
                artists.push(link.textContent);
            });

            let trackArtist = artists.join(", ");

            try {
                // Get metadata 
                const trackTitle = titleElement ? titleElement.textContent : 'No title found';
                const artistName = trackArtist || 'No artist found';
                const imageUrl = smallUrl.replace("ab67616d00004851", "ab67616d0000b273") || defaultImageURL;
                const albumTitle = albumElement ? albumElement.textContent : "No Album found";
                const trackGenre = "";
                const image = await getImageBlob(imageUrl);

                let output = `Song: ${trackTitle} Artists: ${artistName}`; // use this for metadata
                let urlEncodedQuery = encodeURIComponent(output); // url encode payload

                // Service worker logic
                const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];

                // Append track title if not already -> checks if not there (2)
                if (!existingTitles.includes(trackTitle)) {
                    existingTitles.push(trackTitle);
                    localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
                }

                // Sends titles to service_worker (3)
                chrome.runtime.sendMessage({ action: "sendTitles", titles: existingTitles });

                // Creates unique ID used to track progress 
                const id = Date.now().toString();
                // Sends id to service worker (1)
                chrome.runtime.sendMessage({ action: "setId", id: id });

                const getID = await fetch('http://localhost:3000/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                    body: urlEncodedQuery,
                });

                // Get videoID
                const data = await getID.json();
                console.log(data);

                // Send to api to download
                const videoId = data.videoId;
                const postResponse = await fetch(`http://localhost:3000/download?id=${id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: videoId })
                });

                const convertedBlob = await postResponse.blob();
                const convertedAudio = await getAudioUintArray(convertedBlob);
                const taggedBlob = tagAudio({
                    audioBuffer: convertedAudio,
                    title: trackTitle,
                    album: albumTitle,
                    artist: artistName,
                    genre: trackGenre,
                    coverImage: image
                });

                zip.file(`${trackTitle}.mp3`, taggedBlob);
                await sleep(500);
            } catch (error) {
                console.error(`Error processing track:`, error);
            }
        }

        // Now that all downloads are complete, generate the zip file
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = zipUrl;
            a.setAttribute('download', '[SLEEPY_DOWNLOADER] -  Tracks.zip');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(zipUrl);

            // Reset button state after processing all tracks
            btn.innerText = 'Done';
            setTimeout(() => {
                btn.innerText = 'Download All';
                toggleButtons(false);
            }, 2000);
        } catch (error) {
            console.error("Error generating zip:", error);
            btn.innerText = 'Error';
            setTimeout(() => {
                btn.innerText = 'Download All';
            }, 2000);
        }
    };

    return btn;
};

//creates a track download button on spotify
const createSpotifyDownloadButton = () => {
    const btn = document.createElement('button');
    btn.className = 'spotify-button';
    btn.style.background = '#1DB954';
    btn.style.marginLeft = '10px';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';
    btn.style.textAlign = 'center';
    btn.style.padding = '5px 5px ';
    btn.innerText = 'Download';
    btn.onclick = async () => {
        btn.innerText = 'Processing...';
        // get the parent track element for this specific button
        const trackElement = btn.closest('[data-testid="tracklist-row"]');

        // find the div containing artist info within this specific track
        let artistContainer = trackElement.querySelector('span.e-9812-text.encore-text-body-small.encore-internal-color-text-subdued .e-9812-text.encore-text-body-small');
        // use case 2
        if (!artistContainer) {
            artistContainer = trackElement.querySelector('span.e-9812-text.encore-text-body-medium.encore-internal-color-text-subdued');
        }

        if (artistContainer) {
            // get artists
            const artistLinks = artistContainer.querySelectorAll('a');
            const artists = [];

            artistLinks.forEach(link => {
                artists.push(link.textContent);
            });


            // get track title
            const titleElement = trackElement.querySelector('.e-9812-text.encore-text-body-medium.encore-internal-color-text-base');
            //use case 2
            if (!titleElement) {
                titleElement = trackElement.querySelector('a[data-testid="internal-track-link"] div.e-9812-text');
            }
            const trackTitle = titleElement ? titleElement.textContent : "Unknown Track";
            //get track image
            let imageElement = trackElement.querySelector('img.mMx2LUixlnN_Fu45JpFB');

            //use case for when on single track
            if (!imageElement) {
                let singleImage = document.querySelector('img.mMx2LUixlnN_Fu45JpFB.CmkY1Ag0tJDfnFXbGgju._EShSNaBK1wUIaZQFJJQ.Yn2Ei5QZn19gria6LjZj')
                if (singleImage) {
                    imageElement = singleImage
                }

            }
            const smallUrl = imageElement ? imageElement.src : "";
            const imageURL = smallUrl.replace("ab67616d00004851", "ab67616d0000b273") || defaultImageURL// neat hack to get larger image 
            const image = await getImageBlob(imageURL); // convert image to array buffer
            //get album
            const albumElement = trackElement.querySelector('div._TH6YAXEzJtzSxhkGSqu [href^="/album/"]');
            const trackAlbum = albumElement ? albumElement.textContent : "Unknown Album";

            let trackArtist = artists.join(", ")
            //use case for when on artist page 
            if (!trackArtist) {

                let span = document.querySelector('span.e-9812-text[data-encore-id="adaptiveTitle"]');
                if (span) {
                    trackArtist = span.innerText;
                }
            }
            //use case for when on Popular tracks by
            if (!trackArtist) {

                let h2 = document.querySelector('h2.e-9812-text[data-encore-id="text"]');
                if (h2) {
                    trackArtist = h2.innerText;
                }
            }
            console.log(trackArtist)

            let output = `Song: ${trackTitle} Artists: ${trackArtist}` // use this for metafdata
            let urlEncodedQuery = encodeURIComponent(output) // url encode payload

            //service worker logic
            const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];

            // append track title if not already-> checks if not there (2)
            if (!existingTitles.includes(trackTitle)) {
                existingTitles.push(trackTitle);
                localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
            }

            // sends titles to service_worker (3)
            chrome.runtime.sendMessage({ action: "sendTitles", titles: existingTitles });

            //creates unique ID used to track progress 
            const id = Date.now().toString();
            // sends id to service worker (1)
            chrome.runtime.sendMessage({ action: "setId", id: id });


            //Track Genre ? not include in spotify downloads
            let trackGenre = ""


            // send urlencoded query to api -> search for song on youtube
            const getID = await fetch('http://localhost:3000/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: urlEncodedQuery,
            });
            //get videoID
            const data = await getID.json();
            console.log(data)

            // send to api to download
            const videoId = data.videoId
            postResponse = await fetch(`http://localhost:3000/download?id=${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: videoId })
            })
            const convertedBlob = await postResponse.blob()
            const convertedAudio = await getAudioUintArray(convertedBlob);
            const taggedBlob = tagAudio({
                audioBuffer: convertedAudio,
                title: trackTitle,
                album: trackAlbum,
                artist: trackArtist,
                genre: trackGenre,
                coverImage: image
            });


            const blobUrl = URL.createObjectURL(taggedBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.setAttribute('download', `${trackTitle}.mp3`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            btn.innerText = 'Done';

        }
    };
    return btn
}