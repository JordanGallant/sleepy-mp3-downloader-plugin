import { ID3Writer } from 'browser-id3-writer'; // metadata writer 

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

        const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp"; //client id needed for authorization, can be repeated, Souncloud is dumb and bad at security
        const API_URL = "https://api-v2.soundcloud.com/resolve?url="; //very useful url resolver that finds any track from a given playlist url
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


            const response = await fetch(endUrl);
            const data = await response.json();
            //search for progressive audio stream
            const progressiveTranscoding = data.media.transcodings.find(
                transcoding => transcoding.format.protocol === "progressive"
            );
            const transcodingUrl = progressiveTranscoding
                ? progressiveTranscoding.url + "?" + CLIENT_ID
                : null;

            if (!transcodingUrl) {
                throw new Error("No progressive stream available for this track");
            }
            //cache image for metadata - correct the quality
            const imageSmall = data.artwork_url;
            const imageURL = imageSmall.replace(/-large\.(png|jpg)/, "-t1080x1080.png");

            // Cache metadata for later tagging
            const trackTitle = data.title;
            const trackArtist = data.user.username;
            const trackAlbum = data.publisher_metadata?.album_title || "Unknown Album";
            const trackGenre = data.genre;

            //send data to service worker
            chrome.runtime.sendMessage({
                action: "addToPopup",
                title: trackTitle,
                artist: trackArtist,
            });

            //gets audio blob from progressive audio stream url
            const transcodingRes = await fetch(transcodingUrl);
            const transcodingData = await transcodingRes.json();
            const audioRes = await fetch(transcodingData.url);
            const audioBlob = await audioRes.blob();

            //dynamic id generation
            const id = Date.now().toString();
            //send id to service worker
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

setInterval(addDownloadButton, 3000);
