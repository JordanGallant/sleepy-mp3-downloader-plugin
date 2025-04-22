import { ID3Writer } from 'browser-id3-writer';
import lamejs from 'lamejs';


const createDownloadButton = (trackElement) => {
    const btn = document.createElement('button');
    btn.innerText = 'Download';
    btn.className = 'my-sc-download-btn';
    btn.style.marginLeft = '10px';
    btn.style.background = 'orange';
    btn.style.color = 'white';
    btn.style.padding = '5px';

    btn.onclick = async () => {
        btn.innerText = 'Processing...';
        btn.disabled = true;

        const CLIENT_ID = "client_id=EjkRJG0BLNEZquRiPZYdNtJdyGtTuHdp";
        const API_URL = "https://api-v2.soundcloud.com/resolve?url=";
        let trackUrl = 'No URL found';

        if (trackElement.classList.contains('trackItem')) {
            const trackLink = trackElement.querySelector('.trackItem__trackTitle');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        } else if (trackElement.classList.contains('listenEngagement__footer')) {
            trackUrl = window.location.href;
        } else if (trackElement.classList.contains('.systemPlaylistBannerItem')) {
            const trackLink = trackElement.querySelector('.selectionPlaylistBanner__artworkLink');
            trackUrl = trackLink ? trackLink.href : trackUrl;
        }

        const endUrl = API_URL + trackUrl + "&" + CLIENT_ID;

        try {
            const response = await fetch(endUrl);
            const data = await response.json();

            const transcodingUrl = data.media.transcodings[3].url + "?" + CLIENT_ID;
            const imageURL = data.artwork_url;
            const trackTitle = data.title;
            const trackArtist = data.publisher_metadata.artist;
            const trackGenre = data.genre;

            const transcodingRes = await fetch(transcodingUrl);
            const transcodingData = await transcodingRes.blob();
            console.log(transcodingData)
            const audioRes = await fetch(transcodingData.url);
            const audioBlob = await audioRes.blob();

            // Get audio and image data
            const audio = await getAudioUintArray(audioBlob);
            const image = await getImageBlob(imageURL);

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
            const taggedBlob = writer.getBlob();


                //curl request that works....
                //curl -X POST -F "audio=@test.mp3" https://audio-api-6r6z.onrender.com/convert-audio --output converted_audio.mp3

            // Create Payloud to send to API
            const formData = new FormData();
            formData.append('audio', taggedBlob, 'audio.mp3');

            const postResponse = await fetch('https://audio-api-6r6z.onrender.com/convert-audio', {
                method: 'POST',
                body: formData,
            });
    
            if (!postResponse.ok) {
                throw new Error("Failed to upload audio");
            }
    
            // Handle server response (you can modify this based on your server's response)
            const postData = await postResponse.json();
            console.log('Server response:', postData);



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
        }
    };

    return btn;
};
//helper that converts url -> image -> base 64
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

const addDownloadButton = () => {
    const targets = document.querySelectorAll('.trackItem, .sound__soundActions, .systemPlaylistBannerItem, .listenEngagement__footer');
    targets.forEach(target => {
        if (target.querySelector('.my-sc-download-btn')) return;
        const btn = createDownloadButton(target);
        target.appendChild(btn);
    });
};

setInterval(addDownloadButton, 3000);
