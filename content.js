import { ID3Writer } from 'browser-id3-writer'; // metadata writer 

const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp"; //client id needed for authorization, can be repeated, Souncloud is dumb and bad at security
const API_URL = "https://api-v2.soundcloud.com/resolve?url="; //very useful url resolver that finds any track from a given playlist url
const defaultImageURL = "https://images.squarespace-cdn.com/content/v1/57a9f951e6f2e1756d5449ee/1742200459834-CYCOIBSGJO1RM1FX3J4G/DSC_4663.jpg?format=2500w" //if no image from soundcloud show naked lady :p

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
            await scrollToPageBottom() 
            toggleButtons(true);
            
            //gets closest element to the button
            const playlistDetails = songElement.closest('.systemPlaylistDetails');

            const firstNest = playlistDetails.querySelector('.systemPlaylistTrackList'); //parse nested element

            const secondNest = firstNest.querySelector('.systemPlaylistTrackList__list') //parse second nest
            const tracks = secondNest.children; //gets li elements from the playlist
            
            let count = tracks.length;
            console.log(count)

            for (const track of tracks) { // loop through all the tracks

                //displays count of downloads left
                btn.innerText = `(${count})`
                count-=1

                const trackUrl = track.children[0]?.children[2]?.children[2]?.href;
                if (!trackUrl) continue; // Skip if structure doesn't exist

                try {
                    const endUrl = `${API_URL}${trackUrl}&${CLIENT_ID}`;
                    const response = await fetch(endUrl);

                    const data = await response.json();
                    
                
                    //set metadata
                    const streamUrl = await GetStreamURL(data, CLIENT_ID);
                    const imageURL = data.artwork_url?.replace(/-large\.(png|jpg)/, "-t1080x1080.png") || defaultImageURL;

                    const trackTitle = data.title;
                    const trackArtist = data.publisher_metadata?.artist ||  data.user?.username 
                    const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
                    const trackGenre = data.genre;

                    //get audio blob from url
                    const transcodingRes = await fetch(streamUrl);
                    const transcodingData = await transcodingRes.json();
                    const audioRes = await fetch(transcodingData.url);
                    const audioBlob = await audioRes.blob();

                    const existingTitles = JSON.parse(localStorage.getItem('trackTitles')) || [];


                    // append track title if not already-> checks if not there (2)
                    if (!existingTitles.includes(trackTitle)) {
                        existingTitles.push(trackTitle);
                        localStorage.setItem('trackTitles', JSON.stringify(existingTitles));
                    }

                    //sednds titles to service_worker (3)
                    chrome.runtime.sendMessage({ action: "sendTitles", titles: existingTitles });

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
                        .setFrame('TPE1', [trackArtist]) // can be multiple
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
        toggleButtons(false);
        btn.innerText = 'Processing...';

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
            
            //cache image for metadata - correct the quality
            const imageURL = data.artwork_url?.replace(/-large\.(png|jpg)/, "-t1080x1080.png") || defaultImageURL;

            // Cache metadata for later tagging
            const trackTitle = data.title;
            const trackArtist = data.publisher_metadata?.artist ||  data.user?.username 
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
const observeTrackItems = () => {
    const observer = new MutationObserver(() => { //mutation observer ensures that all elements are injected automattically
        const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');
        targets.forEach(target => {
            if (!target.querySelector('.my-sc-download-btn')) {
                const btn = createDownloadButton(target);
                target.appendChild(btn);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
};
//download all button shows at the top of the playlist 
const observePlaylistControls = () => {
    const observer = new MutationObserver(() => {//mutation observer ensures that all elements are injected automattically
        const targets = document.querySelectorAll('.systemPlaylistDetails__controls');
        targets.forEach(target => {
            if (!target.querySelector('.all')) {
                const btn = createDownloadAllButton(target);
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
    const downloadButtons = document.querySelectorAll('.my-sc-download-btn');

    if (isAllDownloading) {
        allButton.disabled = false;
        downloadButtons.forEach(btn => {
            btn.disabled = true;
            btn.innerText = 'Disabled';
        });
    } else {
        allButton.disabled = true;
        allButton.innerText = 'Disabled';
        downloadButtons.forEach(btn => {
            btn.disabled = false;
        });
    }
};

//soundcloud = lazy loaded -> make sure all content is loaded ->  automatically scrolls to the bottom 
async function scrollToPageBottom(timeout = 1000, maxAttempts = 3) {
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



//sleep function to delay processes
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



observeTrackItems();
observePlaylistControls();


