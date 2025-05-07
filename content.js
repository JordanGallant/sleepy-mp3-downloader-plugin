import { ID3Writer } from 'browser-id3-writer'; // metadata writer 
import JSZip from "jszip"; //javascript zip library


const SOUNDCLOUD_CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp"; //client id needed for authorization, can be repeated, Souncloud is dumb and bad at security
const SOUNDCLOUD_API_URL = "https://api-v2.soundcloud.com/resolve?url="; //very useful url resolver that finds any track from a given playlist url
const defaultImageURL = "https://images.squarespace-cdn.com/content/v1/57a9f951e6f2e1756d5449ee/1742200459834-CYCOIBSGJO1RM1FX3J4G/DSC_4663.jpg?format=2500w" //if no image from soundcloud show naked lady :p


//creates a track download button on bandcamp
const createBandCampDownloadButton = () => {
    const btn = document.createElement('button');

    //dynamically get styles :)
    let backgroundColor = '#629aa9'; // fallback default
    let textColor = 'white'
    const styleElement = document.querySelector('style#custom-design-rules-style');
    if (styleElement) {
        const dataAttr = styleElement.getAttribute('data-design');
        if (dataAttr) {
            try {
                const designData = JSON.parse(dataAttr);
                if (designData.link_color) {
                    backgroundColor = `#${designData.link_color}`;
                }
                if (designData.bg_color) {
                    textColor = `#${designData.bg_color}`
                }
            } catch (err) {
                console.warn("Failed to parse data-design attribute:", err);
            }
        }
    }
    Object.assign(btn.style, {
        background: backgroundColor,
        marginLeft: '25px',
        borderRadius: '6px',
        color: textColor,
        textAlign: 'center',
        padding: '2px 6px',
        fontSize: '12px',
        lineHeight: '1.2',
        cursor: 'pointer',
        border: 'none'
    });
    btn.className = 'bandcamp-button';
    btn.textContent = 'Download';
    btn.onclick = async () => {
        const tr = btn.closest('tr'); // Find the closest table row
        let trackTitle;
        if (!tr) {
            trackTitle = (document.querySelector('h2.trackTitle')).textContent.trim()
            console.log(trackTitle)
        } else {
            let trackTitleElement = tr.querySelector('span.track-title');
            trackTitle = trackTitleElement.textContent

            console.log(trackTitle)
        }


        const scriptTag = document.querySelector('script[src="https://s4.bcbits.com/bundle/bundle/1/tralbum_head-5f2cae3cbbe6493a088eaffef359be44.js"]');
        const tralbumData = scriptTag.getAttribute('data-tralbum');
        const parsedData = JSON.parse(tralbumData.replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>'));

        tracks = parsedData.trackinfo;
        console.log(parsedData)







        let mp3Link;
        //sees if it is a single track
        if (tracks.length < 2) {
            const link = tracks[0].file
            mp3Link = link["mp3-128"];

        } else {
            //gets track link based off of track name inside index
            const index = tracks.findIndex(track => track.title === trackTitle);
            const link = tracks[index].file
            mp3Link = link["mp3-128"];

        }

        // Select the h2 element with class trackTitle
        const albumElement = document.querySelector('h2.trackTitle');

        // Get the text content and trim whitespace
        const rawText = albumElement.textContent.trim();

        // Split the text at the hyphen to separate artist from album
        const parts = rawText.split('-');

        let trackArtist, trackAlbum;

        if (parts.length > 1) {
            // If there is a hyphen, artist is to the left and album is to the right
            trackArtist = parts[0].trim();
            trackAlbum = parts.slice(1).join('-').trim();
        } else {
            // If there is no hyphen, set artist name to be the same as album name
            trackArtist = rawText;
            trackAlbum = rawText;
        }


        //get image URL
        const imageElement = document.querySelector('a.popupImage')
        const imageUrl = imageElement.href
        // let image =  await getImageBlob(imageUrl)


        //will feth from api to bypass CORS restrictions
        const fetchImage = await fetch("https://audio-api-6r6z.onrender.com/download-image", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageUrl: imageUrl })
        });
        //gets the base64 image in json format
        const jsonResponse = await fetchImage.json();
        const base64Image = jsonResponse.imageBase64;//selects just base 64 image
        let blob = base64ToBlob(base64Image, 'image/jpeg');//converts base64 to Blob -> custom fucntion
        image = await blob.arrayBuffer();
        //get genre from bottom left
        const tagsDiv = document.querySelector('.tralbumData.tralbum-tags');
        const tagElements = tagsDiv.querySelectorAll('a.tag');
        const trackGenre = Array.from(tagElements).map(tag => tag.textContent.trim());

        //checks if titles are already on local storage
        const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];


        // append track title if not already-> checks if not there (2)
        if (!existingTitles.includes(trackTitle)) {
            existingTitles.push(trackTitle);
            localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
        }

        //sends titles to service_worker (3)
        chrome.runtime.sendMessage({ action: "sendTitles", titles: existingTitles });
        //get audio blob
        let audioBlob;

        const fetchAudio = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "fetchAudio", url: mp3Link }, resolve);
        });

        if (fetchAudio.success) {
            // Decode base64 DataURL back into a blob
            const res = await fetch(fetchAudio.dataUrl);
            audioBlob = await res.blob();

            // Now you can use audioBlob like before
        } else {
            console.error('Failed to fetch audio from service worker');
        }

        //dynamic id generation
        const id = Date.now().toString();
        //sends id to service worker (1)
        chrome.runtime.sendMessage({ action: "setId", id: id });

        // creates payload to send to api
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.mp3');

        const postResponse = await fetch(`https://audio-api-6r6z.onrender.com/convert-audio?id=${id}`, {
            method: 'POST',
            body: formData,
        });

        if (!postResponse.ok) {
            throw new Error("Failed to upload audio");
        }

        // Get converted audio blob
        const convertedBlob = await postResponse.blob();

        const convertedAudio = await getAudioUintArray(convertedBlob);

        //custom function to tage audio blob with metadata
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
    return btn;
};

// creates downlaod all for spotify

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

                const getID = await fetch('https://audio-api-6r6z.onrender.com/search', {
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
                const postResponse = await fetch(`https://audio-api-6r6z.onrender.com/download?id=${id}`, {
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
            const getID = await fetch('https://audio-api-6r6z.onrender.com/search', {
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
            postResponse = await fetch(`https://audio-api-6r6z.onrender.com/download?id=${id}`, {
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

//create a downlaod all button for SOUNDCLOUD playlits
const createDownloadAllSoundCloudButton = (playlistElement) => {
    const btn = document.createElement('button');
    btn.innerText = 'Download All';
    btn.className = 'soundcloud-all-button';
    btn.style.marginLeft = '10px';
    btn.style.background = '#FF5500';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';
    btn.style.padding = '10px 20px'; // Even padding top/bottom and left/right
    btn.style.textAlign = 'center';

    btn.onclick = async () => {
        await scrollToPageBottom();

        let tracks = [];

        // 1. generic playlist structure
        if (playlistElement.closest('.systemPlaylistDetails')) {
            const playlistDetails = playlistElement.closest('.systemPlaylistDetails');
            const firstNest = playlistDetails.querySelector('.systemPlaylistTrackList');
            if (firstNest) {
                const secondNest = firstNest.querySelector('.systemPlaylistTrackList__list');
                if (secondNest) {
                    tracks = Array.from(secondNest.children); // gets li elements from the playlist
                }
            }
        }
        // 2. personal playlist structure
        else if (document.querySelector('.listenDetails__trackList')) {
            const trackList = document.querySelector('.listenDetails__trackList');
            if (trackList) {
                const trackItems = trackList.querySelectorAll('.trackItem');
                if (trackItems.length > 0) {
                    tracks = Array.from(trackItems);
                }
            }
        }
        // 3. listen engagement footer case
        else if (playlistElement.classList.contains('listenEngagement__footer')) {
            const trackItems = document.querySelectorAll('.trackItem');
            tracks = Array.from(trackItems);
        }

        let count = tracks.length;
        console.log(`Found ${count} tracks to download`);

        if (count === 0) {
            btn.innerText = 'No tracks found';
            setTimeout(() => {
                btn.innerText = 'All';
                toggleButtons(false);
            }, 2000);
            return;
        }

        const zip = new JSZip();

        for (const track of tracks) {
            // displays count of downloads left
            btn.innerText = `(${count})`;
            count -= 1;

            let trackUrl;
            // getting track link
            if (track.classList.contains('trackItem')) {
                const trackLink = track.querySelector('.trackItem__trackTitle');
                trackUrl = trackLink ? trackLink.href : null;
            } else {

                const possibleLink = track.querySelector('a[href*="soundcloud.com"]');
                if (possibleLink) {
                    trackUrl = possibleLink.href;
                } else {
                    trackUrl = track.children[0]?.children[2]?.children[2]?.href;
                }
            }

            if (!trackUrl) {
                console.log("No URL found for track, skipping");
                continue; // Skip if no URL found
            }

            try {
                const endUrl = `${SOUNDCLOUD_API_URL}${trackUrl}&${SOUNDCLOUD_CLIENT_ID}`;
                const response = await fetch(endUrl);
                const data = await response.json();

                // set metadata
                const streamUrl = await GetStreamURL(data, SOUNDCLOUD_CLIENT_ID);
                const imageURL = data.artwork_url?.replace(/-large\.(png|jpg)/, "-t1080x1080.png") || defaultImageURL;

                const trackTitle = data.title;
                const trackArtist = data.publisher_metadata?.artist || data.user?.username;
                const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
                const trackGenre = data.genre;

                // get audio blob from url
                const transcodingRes = await fetch(streamUrl);
                const transcodingData = await transcodingRes.json();
                const audioRes = await fetch(transcodingData.url);
                const audioBlob = await audioRes.blob();


                //logic for service worker
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

                // create payload to send to API
                const formData = new FormData();
                formData.append('audio', audioBlob, 'audio.mp3');

                const postResponse = await fetch(`https://audio-api-6r6z.onrender.com/convert-audio?id=${id}`, {
                    method: 'POST',
                    body: formData,
                });

                if (!postResponse.ok) {
                    throw new Error("Failed to upload audio");
                }

                // Get converted audio blob
                const convertedBlob = await postResponse.blob();

                const convertedAudio = await getAudioUintArray(convertedBlob);
                const image = await getImageBlob(imageURL);

                // create new metadata writer
                const taggedBlob = tagAudio({
                    audioBuffer: convertedAudio,
                    title: trackTitle,
                    album: trackAlbum,
                    artist: trackArtist,
                    genre: trackGenre,
                    coverImage: image
                });
                //zip file
                zip.file(`${trackTitle}.mp3`, taggedBlob);





                await sleep(500);

            } catch (error) {
                console.error(`Error processing track: ${trackUrl}`, error);
            }
        }

        zip.generateAsync({ type: "blob" })
            .then(function (content) {
                const zipUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.setAttribute('download', '[SLEEPY_DOWNLOADER] -  Tracks.zip');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(zipUrl);
            });

        // Reset button state after processing all tracks
        btn.innerText = 'Done';
        setTimeout(() => {
            btn.innerText = 'All';
            toggleButtons(false);
        }, 2000);
    };

    return btn;
};

//donwload individual tracks on soundcloud
const createSoundCloudDownloadButton = (trackElement) => {
    const btn = document.createElement('button');

    btn.innerText = 'Download';
    btn.className = 'soundcloud-button';
    btn.style.marginLeft = '10px';
    btn.style.background = '#FF5500';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';

    btn.onclick = async () => {
        toggleButtons(false);
        btn.innerText = 'Processing...';
        let trackUrl = 'No URL found';

        //finds links in DOM elements based off of classes
        if (trackElement.classList.contains('trackItem')) {
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        } else if (trackElement.classList.contains('listenEngagement__footer')) {
            trackUrl = window.location.href;
        } else if (trackElement.classList.contains('systemPlaylistBannerItem')) { // Removed the dot
            const trackLink = trackElement.querySelector('.selectionPlaylistBanner__artworkLink');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        } else if (trackElement.classList.contains('trackList__list')) {
            // Use trackItem__trackTitle instead of trackItem__separator which isn't a link
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        }

        // Check if a valid trackUrl was found
        if (trackUrl === 'No URL found') {
            console.error('Could not find track URL');
            btn.innerText = 'Failed';
            return;
        }
        //console logs Client ID for spotify make = CLIENT_ID
        clientId = await getClientId()
        console.log(clientId);


        //url to find audio transcoded audio streams
        const endUrl = SOUNDCLOUD_API_URL + trackUrl + "&" + SOUNDCLOUD_CLIENT_ID;

        try {
            //fetchURL that has stream data
            const response = await fetch(endUrl);
            const data = await response.json();

            //search for progressive audio stream
            const streamUrl = await GetStreamURL(data, SOUNDCLOUD_CLIENT_ID);

            //cache image for metadata - correct the quality
            const imageURL = data.artwork_url?.replace(/-large\.(png|jpg)/, "-t1080x1080.png") || defaultImageURL;

            // Cache metadata for later tagging
            const trackTitle = data.title;
            const trackArtist = data.publisher_metadata?.artist || data.user?.username
            const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
            const trackGenre = data.genre;


            /// gets array of strings from local storage or creates an empty array (1)
            const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];


            // append track title if not already-> checks if not there (2)
            if (!existingTitles.includes(trackTitle)) {
                existingTitles.push(trackTitle);
                localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
            }

            //sends titles to service_worker (3)
            chrome.runtime.sendMessage({ action: "sendTitles", titles: existingTitles });

            //gets audio blob from progressive audio stream url
            const transcodingRes = await fetch(streamUrl);
            const transcodingData = await transcodingRes.json();
            const audioRes = await fetch(transcodingData.url);
            const audioBlob = await audioRes.blob();

            //dynamic id generation
            const id = Date.now().toString();
            //sends id to service worker (1)
            chrome.runtime.sendMessage({ action: "setId", id: id });

            // creates payload to send to api
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.mp3');

            //send untagged audio blob to API - where it will be converted to 320 kbps 
            const postResponse = await fetch(`https://audio-api-6r6z.onrender.com/convert-audio?id=${id}`, {
                method: 'POST',
                body: formData,
            });

            if (!postResponse.ok) {
                throw new Error("Failed to upload audio");
            }

            // Get converted audio blob
            const convertedBlob = await postResponse.blob();

            // Now tag the converted audio
            const convertedAudio = await getAudioUintArray(convertedBlob);
            const image = await getImageBlob(imageURL);

            const taggedBlob = tagAudio({
                audioBuffer: convertedAudio,
                title: trackTitle,
                album: trackAlbum,
                artist: trackArtist,
                genre: trackGenre,
                coverImage: image
            });

            // download the final tagged audio
            const blobUrl = URL.createObjectURL(taggedBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.setAttribute('download', `${trackTitle}.mp3`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            btn.innerText = 'Done';
        } catch (error) {
            console.error("Error during download process:", error);
            btn.innerText = 'Failed';
        }
    };

    return btn;
};

// helper: fetches image and returns array buffer so it can be stored in metadata
const getImageBlob = async (url) => {
    const response = await fetch(url);
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    return arrayBuffer;
};

// helper: converts aduio blob to Uint8Array so it can be stored in metadata
const getAudioUintArray = async (blob) => {
    const audioArrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(audioArrayBuffer);
};

// dynamically injects buttons into the DOM on each soundcloud track
const observeTrackItems = () => {
    const observer = new MutationObserver(() => {
        const allSoundcloudTargets = document.querySelectorAll('.trackItem, .systemPlaylistBannerItem');
        const spotifyTargets = document.querySelectorAll('.oIeuP60w1eYpFaXESRSg.oYS_3GP9pvVjqbFlh9tq .PAqIqZXvse_3h6sDVxU0[role="gridcell"], .oIeuP60w1eYpFaXESRSg .PAqIqZXvse_3h6sDVxU0[role="gridcell"]');
        const bandcampTargets = document.querySelectorAll('td.download-col, div.digitaldescription');

        // Check if Bandcamp page is for an Album
        const typeEl = document.querySelector('span.buyItemPackageTitle');

        //checks if bandcmap age is album or track
        const isAlbum = typeEl?.textContent?.trim().includes("Album");

        let filteredBandcampTargets = Array.from(bandcampTargets);

        if (isAlbum) {
            filteredBandcampTargets = filteredBandcampTargets.filter(el => {

                return !el.closest('div.digitaldescription');
            });
        }

        filteredBandcampTargets.forEach(target => {
            if (!target.querySelector('.bandcamp-button')) {
                const btn = createBandCampDownloadButton();
                target.appendChild(btn);
            }
        });

        spotifyTargets.forEach(target => {
            if (!target.querySelector('.spotify-button')) {
                const btn = createSpotifyDownloadButton();
                target.appendChild(btn);
            }
        });

        const soundcloudTargets = Array.from(allSoundcloudTargets).filter(el => {
            return !el.closest('ul.compactTrackList__list');
        });

        soundcloudTargets.forEach(target => {
            if (!target.querySelector('.soundcloud-button')) {
                const btn = createSoundCloudDownloadButton(target);
                target.appendChild(btn);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

//download all button shows at the top of the soundcloud playlist 
const observePlaylistControls = () => {
    const observer = new MutationObserver(() => {
        // Add .listenDetails__trackList to the selector list
        const allSoundcloudTargets = document.querySelectorAll('.systemPlaylistDetails__controls, .listenEngagement__footer');
        const allSpotifyTargets = document.querySelectorAll('.eSg4ntPU2KQLfpLGXAww')

        const commentsListExists = document.querySelector('.commentsList') !== null;

        // Filter out buttons if comments list exists
        const soundcloudTargets = Array.from(allSoundcloudTargets).filter(el => {
            // Don't render the button if comments list exists OR if element is inside track page
            return !commentsListExists && !el.closest('section[data-testid="track-page"]');
        });

        //filters out popular track-page div -> SPOTIFY
        const spotifyTargets = Array.from(allSpotifyTargets).filter(el => {
            return !el.closest('section[data-testid="track-page"]');
        });

        soundcloudTargets.forEach(target => {
            if (!target.querySelector('.soundcloud-all-button')) {
                const btn = createDownloadAllSoundCloudButton(target);

                //handles personal playlists on soundlcoud
                if (target.classList.contains('listenDetails__content')) {
                    // for the new use case, find a good container for the button
                    const controlContainer = target.querySelector('.listenDetails__tracklistControls') || target;
                    controlContainer.appendChild(btn);
                } else {
                    target.appendChild(btn);
                }
            }
        });

        spotifyTargets.forEach(target => {
            if (!target.querySelector('.spotify-all-button')) {
                const btn = createDownloadAllSpotifyButton();
                target.appendChild(btn);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

//reusable: function to get streamURL 
function GetStreamURL(data, clientId) {
    const progressiveTranscoding = data.media.transcodings.find(
        transcoding => transcoding.format.protocol === "progressive"
    );

    if (!progressiveTranscoding) {
        throw new Error("No progressive stream available for this track");
    }

    return `${progressiveTranscoding.url}?${clientId}`;
}

//function only allows all OR single donwloads
const toggleButtons = (isAllDownloading) => {
    const allButton = document.querySelector('.all');
    const downloadButtons = document.querySelectorAll('.soundcloud-button');

    if (isAllDownloading) {
        // Check if allButton exists before setting disabled property
        if (allButton) {
            allButton.disabled = false;
        }

        // Only modify buttons that exist
        downloadButtons.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Disabled';
            }
        });
    } else {
        // Check if allButton exists before setting disabled property
        if (allButton) {
            allButton.disabled = true;
            allButton.innerText = 'Disabled';
        }

        // Only modify buttons that exist
        downloadButtons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
            }
        });
    }
};

//soundcloud = lazy loaded -> make sure all content is loaded ->  automatically scrolls to the bottom 
async function scrollToPageBottom(timeout = 1000, maxAttempts = 30) {
    let lastHeight = 0;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const currentHeight = document.body.scrollHeight;

        window.scrollTo({
            top: currentHeight,
            behavior: 'smooth'
        });

        await sleep(timeout); // waits 1 seconds

        if (document.body.scrollHeight === lastHeight) {
            break; // if no new content is loaded-> done checking
        }

        lastHeight = document.body.scrollHeight;
        attempts++;
    }
}

//re usable function that taggs audio blob after conversion
function tagAudio({
    audioBuffer,
    title,
    album,
    artist,
    genre = '',
    coverImage,
}) {
    const writer = new ID3Writer(audioBuffer);
    writer
        .setFrame('TIT2', title)
        .setFrame('TALB', album)
        .setFrame('TPE1', [artist])
        .setFrame('TCON', [genre])
        .setFrame('APIC', {
            type: 3,
            data: coverImage,
            description: 'Cover',
        });
    writer.addTag();
    return writer.getBlob();
}

//dynamically get client ID from soundlcloud
async function getClientId() {
    try {
        const response = await fetch('https://audio-api-6r6z.onrender.com/get-soundcloud-clientid', { method: 'POST' });
        const clientId = await response.text();
        return clientId;
        // use clientId here
    } catch (error) {
        console.error('Error fetching SoundCloud Client ID:', error);
    }
}

//sleep function to delay processes
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//helper from  base 64 -> blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

observeTrackItems();
observePlaylistControls();
