import { ID3Writer } from 'browser-id3-writer'; // metadata writer 


const createDownloadButton = (trackElement) => {

    const btn = document.createElement('button');
    btn.innerText = 'Download';
    btn.className = 'my-sc-download-btn';
    btn.style.marginLeft = '10px';
    btn.style.background = '#FF5500';
    btn.style.borderRadius = '10px'
    btn.style.color = 'white';

    btn.onclick = async () => {
        chrome.runtime.sendMessage({ action: "showPopup" });
        btn.innerText = 'Processing...';
        btn.disabled = true;

        //url has to be authorized with client ID to get track info -  this can be reused (they suck at security)
        const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp";
        const API_URL = "https://api-v2.soundcloud.com/resolve?url="; //resolves any track from playlist url - very useful
        let trackUrl = 'No URL found'; //default track url

        //get link from dom objects based off of class name
        if (trackElement.classList.contains('trackItem')) {
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;

        } else if (trackElement.classList.contains('listenEngagement__footer')) {
            trackUrl = window.location.href;
        } else if (trackElement.classList.contains('.systemPlaylistBannerItem')) {
            const trackLink = trackElement.querySelector('.selectionPlaylistBanner__artworkLink');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        }
        // create the url to get the transcoded audio stream
        const endUrl = API_URL + trackUrl + "&" + CLIENT_ID;

        try {
            //requeust to api for specific song
            const response = await fetch(endUrl);
            const data = await response.json(); //convert to json


            //find progressive audio stream - wow (i think this slow it down)
            const progressiveTranscoding = data.media.transcodings.find(
                transcoding => transcoding.format.protocol === "progressive"
            );
            const transcodingUrl = progressiveTranscoding 
                ? progressiveTranscoding.url + "?" + CLIENT_ID
                : null;
            
            if (!transcodingUrl) {
                console.error("No progressive stream found");
                throw new Error("No progressive stream available for this track");
            }
            console.log(transcodingUrl);

            //get image for metadata
            let imageSmall = data.artwork_url; //default image - bad quality
            const imageURL = imageSmall.replace("-large.png", "-t1080x1080.png")

            //collect information for metadata
            const trackTitle = data.title; 
            const trackArtist = data.user.username; 
            const trackAlbum =  data.publisher_metadata.album_title || "Single" /
            console.log(trackAlbum)
            console.log(trackArtist)
            const trackGenre = data.genre; 

            //get actual audio
            const transcodingRes = await fetch(transcodingUrl);
            const transcodingData = await transcodingRes.json();
            const audioRes = await fetch(transcodingData.url);
            const audioBlob = await audioRes.blob();// untagged audio Blob


            // Get audio and image data objects
            const audio = await getAudioUintArray(audioBlob);
            const image = await getImageBlob(imageURL);

            //create metadata writer
            const writer = new ID3Writer(audio);
            writer
                .setFrame('TIT2', trackTitle)
                .setFrame('TPE1', [trackArtist, ""])
                .setFrame('TCON', [trackGenre, ""])
                .setFrame('APIC', {
                    type: 3,
                    data: image,
                    description: 'Cover',
                });
            writer.addTag();
            const taggedBlob = writer.getBlob(); //tagged
            console.log(taggedBlob)


            // create payload to send to API
            const formData = new FormData();
            formData.append('audio', taggedBlob, 'audio.mp3');

            //sends audio blob to api at the convert-audio endpoint
            const postResponse = await fetch('https://audio-api-6r6z.onrender.com/convert-audio', {
                method: 'POST',
                body: formData,
            });

            if (!postResponse.ok) {
                throw new Error("Failed to upload audio");
            }

            // Handle server response -> 320kbs 
            const convertedBlob = await postResponse.blob();// converts MP3 to blob
            console.log('Server response:', convertedBlob);



            //donwload converted & tagged MP3
            const blobUrl = URL.createObjectURL(convertedBlob);
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
        }
    };

    return btn;
};
//helper that converts url -> image -> array buffer
const getImageBlob = async (url) => {
    const response = await fetch(url);
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    return arrayBuffer;
};
// helper that converts audio blob -> uint array
const getAudioUintArray = async (blob) => {
    const audioArrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(audioArrayBuffer);
};
//dynamically injects download button into the DOM
const addDownloadButton = () => {
    const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');
    targets.forEach(target => {
        if (target.querySelector('.my-sc-download-btn')) return;
        const btn = createDownloadButton(target);
        target.appendChild(btn);
    });
};

setInterval(addDownloadButton, 3000);

