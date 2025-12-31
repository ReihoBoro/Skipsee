const socket = io('http://localhost:3000'); // Explicit connection URL for CORS

// DOM Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const skipBtn = document.getElementById('skip-btn');
const remoteStatus = document.getElementById('remote-status');
const spinner = document.getElementById('spinner');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

let localStream;
let peerConnection;
let partnerId = null;

// WebRTC Config
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Application State
let isSearching = false;

// Initialize Local Video
async function initLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Error accessing media devices:', err);
        alert('Please allow camera and microphone access to use Skipsee.');
    }
}

initLocalVideo();

// Socket Events
socket.on('match', async ({ partnerId: id, initiator }) => {
    console.log('Matched with:', id, 'Initiator:', initiator);
    partnerId = id;
    setUIState('connected');

    // Create Peer Connection
    createPeerConnection(initiator);
});

socket.on('signal', async ({ signal, sender }) => {
    if (!peerConnection) return;
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        if (peerConnection.signalingState === 'have-remote-offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('signal', { target: sender, signal: peerConnection.localDescription });
        }
    } catch (err) {
        console.error('Error handling signal:', err);
    }
});

socket.on('message', ({ message, sender }) => {
    addMessage(message, 'partner');
});

socket.on('user-disconnected', () => {
    endCall(true);
    // Optionally auto-search again or just show status
    remoteStatus.innerText = 'Partner disconnected';
    addMessage('Partner disconnected.', 'system');
});

socket.on('remote-skip', () => {
    endCall(true);
    remoteStatus.innerText = 'Partner skipped you.';
    addMessage('Partner skipped.', 'system');
});

socket.on('waiting', () => {
    addMessage('Waiting for a partner...', 'system');
    remoteStatus.innerText = 'Waiting for someone to join...';
});

// Helper Functions
function createPeerConnection(initiator) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        remoteStatus.style.display = 'none'; // Hide text when video plays
        spinner.style.display = 'none';
    };

    // ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Note: In a full implementation, we should send candidates individually. 
            // For simplicity here, we often wait for full gathering or rely on the Offer/Answer exchange containing them if we wait.
            // But let's send them if we have a signaling channel for candidate messages.
            // My server.js 'signal' event handles full SDPS, so let's stick to standard negotiation. 
            // Actually, for robust WebRTC, we need to exchange candidates. 
            // I'll re-use the 'signal' event for candidates too.
            socket.emit('signal', { target: partnerId, signal: { candidate: event.candidate } });
        }
    };

    // Handle incoming candidates (Updated logic in socket 'signal' listener needed)
    // Wait... my previous 'signal' listener was simple. Let's patch it.

    if (initiator) {
        createOffer();
    }
}

// Monkey-patching the signal listener for better candidate handling
socket.off('signal');
socket.on('signal', async ({ signal, sender }) => {
    if (!peerConnection) return;

    if (signal.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
            console.error('Error adding ice candidate:', err);
        }
    } else if (signal.type === 'offer') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('signal', { target: sender, signal: peerConnection.localDescription });
        } catch (err) { console.error(err); }
    } else if (signal.type === 'answer') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (err) { console.error(err); }
    }
});


async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { target: partnerId, signal: peerConnection.localDescription });
    } catch (err) {
        console.error('Error creating offer:', err);
    }
}

function endCall(remoteClosed = false) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    partnerId = null;

    if (!remoteClosed) {
        // user manually stopped
        setUIState('idle');
    } else {
        setUIState('idle'); // Or 'searching' if auto-next
        remoteStatus.innerText = 'Partner disconnected.';
        remoteStatus.style.display = 'block';
    }
}

function setUIState(state) {
    if (state === 'searching') {
        isSearching = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        skipBtn.style.display = 'block';
        remoteStatus.innerText = 'Searching for a partner...';
        remoteStatus.style.display = 'block';
        spinner.style.display = 'block';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        chatMessages.innerHTML = '<div class="system-msg">Looking for someone...</div>';
    } else if (state === 'connected') {
        isSearching = false;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        skipBtn.style.display = 'block';
        remoteStatus.style.display = 'none'; // Video covers it probably, but good to hide
        spinner.style.display = 'none';
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatMessages.innerHTML = '<div class="system-msg">You are connected! Say hi.</div>';
    } else if (state === 'idle') {
        isSearching = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        skipBtn.style.display = 'block';
        remoteStatus.innerText = 'Click Start to find a partner';
        remoteStatus.style.display = 'block';
        spinner.style.display = 'none';
        chatInput.disabled = true;
        sendBtn.disabled = true;
    }
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !partnerId) return;

    socket.emit('message', { target: partnerId, message: text });
    addMessage(text, 'me');
    chatInput.value = '';
}

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.classList.add('user-msg');
    div.classList.add(sender === 'me' ? 'msg-me' : 'msg-partner');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event Listeners
startBtn.addEventListener('click', () => {
    addMessage('Attempting to connect...', 'partner'); // Debug log
    try {
        if (!socket.connected) {
            addMessage('Socket not connected! Reconnecting...', 'partner');
            socket.connect();
        }
        socket.emit('join');
        setUIState('searching');
        const branding = document.getElementById('branding-overlay');
        if (branding) branding.style.display = 'none';
    } catch (e) {
        console.error(e);
        addMessage('Error: ' + e.message, 'partner');
    }
});

stopBtn.addEventListener('click', () => {
    location.reload();
});

skipBtn.addEventListener('click', () => {
    socket.emit('skip', { target: partnerId });
    endCall();
    socket.emit('join'); // Re-queue
    setUIState('searching');
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Profile Dropdown
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutBtn = document.getElementById('logout-btn');
const noiseToggle = document.getElementById('noise-reduction-toggle');

profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!profileTrigger.contains(e.target)) {
        profileDropdown.classList.remove('active');
    }
});

logoutBtn.addEventListener('click', () => {
    // For now, since no real auth, just reload to "log out" visual
    alert('Logged out successfully.');
    location.reload();
});

noiseToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    console.log('Noise Reduction:', enabled);

    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const track = audioTracks[0];
            try {
                // Attempt to apply constraints
                await track.applyConstraints({
                    noiseSuppression: enabled,
                    echoCancellation: enabled
                });
                console.log('Applied improved audio constraints');
            } catch (err) {
                console.warn('Could not apply constraints, restarting stream...', err);
                // Fallback: Restart stream if applyConstraints fails
                stopTracks();
                // We'd need to re-init video. But since we are connected, 
                // swapping tracks in PeerConnection is complex. 
                // For simplicity, we just apply constraints, if it fails, we mostly ignore or alert.
                // Re-negotiation is complex for this task scope.
            }
        }
    }
});

function stopTracks() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
}

