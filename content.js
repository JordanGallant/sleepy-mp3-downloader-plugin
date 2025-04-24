import { ID3Writer } from 'browser-id3-writer'; // metadata writer 

const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp"; //client id needed for authorization, can be repeated, Souncloud is dumb and bad at security
const API_URL = "https://api-v2.soundcloud.com/resolve?url="; //very useful url resolver that finds any track from a given playlist url


//create a downlaod all button for playlits
const createDownloadAllButton = (songElement) => {
    const btn = document.createElement('button');
    btn.innerText = 'All';
    btn.className = 'all';
    btn.style.marginLeft = '10px';
    btn.style.background = '#FF5500';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';
    btn.style.padding = '10px 20px'; // Even padding top/bottom and left/right
    btn.style.textAlign = 'center';

    btn.onclick = async () => {
        btn.onclick = async () => {


            btn.innerText = 'Processing...';
            //gets closest element to the button
            const playlistDetails = songElement.closest('.systemPlaylistDetails');

            const firstNest = playlistDetails.querySelector('.systemPlaylistTrackList'); //parse nested element

            const secondNest = firstNest.querySelector('.systemPlaylistTrackList__list') //parse second nest
            const tracks = secondNest.children; //gets li elements from the playlist
            for (const track of tracks) { // loop through all the tracks
                const trackUrl = track.children[0]?.children[2]?.children[2]?.href;
                if (!trackUrl) continue; // Skip if structure doesn't exist

                try {
                    const endUrl = `${API_URL}${trackUrl}&${CLIENT_ID}`;
                    const response = await fetch(endUrl);

                    const data = await response.json();
                    console.log(data)

                    //set metadata
                    const streamUrl = await GetStreamURL(data, CLIENT_ID);
                    const imageURL = data.artwork_url?.replace(/-large\.(png|jpg)/, "-t1080x1080.png");
                    console.log(streamUrl)

                    const trackTitle = data.title;
                    const trackArtist = data.user.username;
                    const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
                    const trackGenre = data.genre;

                    //get audio blob from url
                    const transcodingRes = await fetch(streamUrl);
                    const transcodingData = await transcodingRes.json();
                    const audioRes = await fetch(transcodingData.url);
                    const audioBlob = await audioRes.blob();

                    const id = Date.now().toString();
                    //sends id to service worker (1)
                    chrome.runtime.sendMessage({ action: "setId", id: id });

                    //create payload to send to API
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'audio.mp3');

                    const postResponse = await fetch(`https://audio-api-6r6z.onrender.com/convert-audio?id=${id}`, {
                        method: 'POST',
                        body: formData,
                    });
                    console.log(postResponse)

                    if (!postResponse.ok) {
                        throw new Error("Failed to upload audio");
                    }

                    // Get converted audio blob
                    const convertedBlob = await postResponse.blob();

                    const convertedAudio = await getAudioUintArray(convertedBlob);
                    const image = await getImageBlob(imageURL);


                    //create new metadata writer
                    const writer = new ID3Writer(convertedAudio);
                    writer
                        .setFrame('TIT2', trackTitle)
                        .setFrame('TALB', trackAlbum)
                        .setFrame('TPE1', [trackArtist])
                        .setFrame('TALB', trackAlbum)
                        .setFrame('TCON', [trackGenre || ""])
                        .setFrame('APIC', {
                            type: 3,
                            data: image,
                            description: 'Cover',
                        });
                    writer.addTag();
                    const taggedBlob = writer.getBlob();

                    // download the final tagged audio
                    const blobUrl = URL.createObjectURL(taggedBlob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.setAttribute('download', `${trackTitle}.mp3`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);

                    console.log(convertedBlob);
                    await sleep(500);

                } catch (error) {
                    console.error(`Error processing track: ${trackUrl}`, error);
                }
            }




        };

    }

    return btn;
}


const createDownloadButton = (trackElement) => {
    const btn = document.createElement('button');

    btn.innerText = 'Download';
    btn.className = 'my-sc-download-btn';
    btn.style.marginLeft = '10px';
    btn.style.background = '#FF5500';
    btn.style.borderRadius = '10px';
    btn.style.color = 'white';

    btn.onclick = async () => {

        btn.innerText = 'Processing...';
        btn.disabled = true;

        let trackUrl = 'No URL found';

        //finds links in DOM elements based off of classes

        if (trackElement.classList.contains('trackItem')) {
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        } else if (trackElement.classList.contains('listenEngagement__footer')) {
            trackUrl = window.location.href;
        } else if (trackElement.classList.contains('.systemPlaylistBannerItem')) {
            const trackLink = trackElement.querySelector('.selectionPlaylistBanner__artworkLink');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        }
        //url to find audio transcoded audio streams
        const endUrl = API_URL + trackUrl + "&" + CLIENT_ID;

        try {

            //fetchURL that has stream data
            const response = await fetch(endUrl);
            const data = await response.json();
            //search for progressive audio stream
            const streamUrl = await GetStreamURL(data, CLIENT_ID);
            console.log(streamUrl);
            //cache image for metadata - correct the quality
            const imageSmall = data.artwork_url;
            const imageURL = imageSmall.replace(/-large\.(png|jpg)/, "-t1080x1080.png");

            // Cache metadata for later tagging
            const trackTitle = data.title;
            const trackArtist = data.user.username;
            const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
            const trackGenre = data.genre;


            /// gets array of strings from local storage or creates an empty array (1)
            const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];


            // append track title if not already-> checks if not there (2)
            if (!existingTitles.includes(trackTitle)) {
                existingTitles.push(trackTitle);
                localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
            }

            console.log('Updated trackTitles:', existingTitles);
            //sednds titles to service_worker (3)
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
            console.log(postResponse)

            if (!postResponse.ok) {
                throw new Error("Failed to upload audio");
            }

            // Get converted audio blob
            const convertedBlob = await postResponse.blob();

            // Now tag the converted audio
            const convertedAudio = await getAudioUintArray(convertedBlob);
            const image = await getImageBlob(imageURL);


            //create new metadata writer
            const writer = new ID3Writer(convertedAudio);
            writer
                .setFrame('TIT2', trackTitle)
                .setFrame('TALB', trackAlbum)
                .setFrame('TPE1', [trackArtist])
                .setFrame('TALB', trackAlbum)
                .setFrame('TCON', [trackGenre || ""])
                .setFrame('APIC', {
                    type: 3,
                    data: image,
                    description: 'Cover',
                });
            writer.addTag();
            const taggedBlob = writer.getBlob();

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

// dynamically injects buttons into the DOM
const addDownloadButton = () => {
    const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');
    targets.forEach(target => {
        if (target.querySelector('.my-sc-download-btn')) return;
        const btn = createDownloadButton(target);
        target.appendChild(btn);
    });
};
//download all button shows at the top of the playlist 
const addDownloadAllButton = () => {
    const targets = document.querySelectorAll('.systemPlaylistDetails__controls');
    targets.forEach(target => {
        if (target.querySelector('.all')) return;
        const btn = createDownloadAllButton(target);
        target.appendChild(btn);
    });
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

//sleep function to delay processes
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


setInterval(addDownloadAllButton, 5000);
setInterval(addDownloadButton, 3000);


