// --- Socket Initialization ---
let socket;
// Socket will be initialized in init()

// --- Variables ---
let localVideo, remoteVideo, chatLog, chatInput, sendBtn, startBtn, nextBtn, stopBtn;
let connectionStatus, onlineCountNum, remotePlaceholder;
let interestInput, interestsContainer;
let interests = [];
let localStream;
let peerConnection;
let isInitiator = false;
let isConnected = false;
let userData = null; // Global user data

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log("Initializing Omen...");

    // 1. Select DOM Elements
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    chatLog = document.getElementById('chat-log');
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    startBtn = document.getElementById('start-btn');
    nextBtn = document.getElementById('next-btn');
    stopBtn = document.getElementById('stop-btn');
    connectionStatus = document.getElementById('connection-status');
    onlineCountNum = document.getElementById('online-count-num');
    remotePlaceholder = document.querySelector('#stranger-video-wrapper .video-placeholder');
    interestInput = document.getElementById('interest-input');
    interestsContainer = document.getElementById('interests-container');

    // 2. Attach Event Listeners
    if (startBtn) startBtn.addEventListener('click', startSearch);
    if (stopBtn) stopBtn.addEventListener('click', stopChat);
    if (nextBtn) nextBtn.addEventListener('click', nextChat);
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (interestInput) {
        interestInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = interestInput.value.trim();
                if (tag) {
                    addInterest(tag);
                    interestInput.value = '';
                }
            } else if (e.key === 'Backspace' && interestInput.value === '' && interests.length > 0) {
                removeInterest(interests[interests.length - 1]);
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isConnected) nextChat();
            else if (startBtn && !startBtn.disabled) startSearch();
        }
    });

    // 3. User & Socket Setup
    try {
        if (typeof io !== 'undefined') {
            socket = io();
        } else {
            console.warn('Socket.io not loaded. Running in offline/UI-only mode.');
            // Mock socket placeholder
            socket = {
                on: (e, cb) => {
                    if (!socket._callbacks) socket._callbacks = {};
                    socket._callbacks[e] = cb;
                },
                emit: (e, data) => {
                    console.log('Mock emit:', e, data);
                },
                connected: false,
                _callbacks: {}
            };
        }

        // Register events immediately to avoid missing them
        if (socket) {
            socket.on('user_count', (count) => {
                if (onlineCountNum) onlineCountNum.textContent = count.toLocaleString();
            });

            socket.on('partner_found', async ({ initiator, commonInterests }) => {
                isInitiator = initiator;
                isConnected = true;
                setUIState('connected');

                if (commonInterests && commonInterests.length > 0) {
                    addSystemMessage(`You matched on interests: ${commonInterests.join(', ')}`);
                } else {
                    // addSystemMessage('You\'re now chatting with a random stranger. Say Hi!');
                }

                createPeerConnection();

                if (isInitiator) {
                    try {
                        const offer = await peerConnection.createOffer();
                        await peerConnection.setLocalDescription(offer);
                        socket.emit('signal', { type: 'offer', sdp: offer });
                    } catch (err) {
                        console.error('Offer error:', err);
                    }
                }
            });

            socket.on('signal', async (data) => {
                if (!peerConnection) return;
                try {
                    if (data.type === 'offer') {
                        if (isInitiator) return;
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        socket.emit('signal', { type: 'answer', sdp: answer });
                    } else if (data.type === 'answer') {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    } else if (data.candidate) {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                } catch (err) {
                    console.error('Signal error:', err);
                }
            });

            socket.on('partner_disconnected', () => {
                addSystemMessage('Stranger has disconnected.');
                stopChat();
            });

            socket.on('chat_message', (data) => {
                addMessage('Stranger', data.text);
            });
        }

    } catch (e) {
        console.error('Socket init failed:', e);
    }
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            userData = {
                email: data.user.email,
                displayName: data.user.displayName,
                uid: data.user.id,
                photoURL: data.user.photo || null
            };
            console.log("Logged in as:", userData.displayName);

            // Update UI
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');

            if (userNameEl) userNameEl.textContent = userData.displayName;
            if (userAvatarEl && userData.photoURL) userAvatarEl.src = userData.photoURL;

        }
    } catch (e) {
        console.warn("User fetch failed, using Guest.");
    }

    if (!userData) {
        userData = {
            email: "guest@example.com",
            displayName: "Guest",
            uid: "guest_" + Math.random().toString(36).substr(2, 9),
            photoURL: null
        };
    }

    if (socket) {
        if (socket.connected) {
            socket.emit('join_user', userData);
        } else {
            socket.on('connect', () => {
                socket.emit('join_user', userData);
                console.log("Socket connected!");
            });
        }
    }

    // 4. Media Setup
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Media error:", err);
        addSystemMessage("Camera/Mic access denied. You can still chat.");
    }

    // 5. Initial UI State
    setUIState('idle');
}

// --- Logic Functions ---

function addInterest(tag) {
    tag = tag.toLowerCase();
    if (!interests.includes(tag)) {
        interests.push(tag);
        renderInterests();
    }
}

function removeInterest(tag) {
    interests = interests.filter(t => t !== tag);
    renderInterests();
}

function renderInterests() {
    if (!interestsContainer) return;

    // Clear existing tags (keep input)
    const input = document.getElementById('interest-input');
    interestsContainer.innerHTML = '';

    interests.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'interest-tag';
        tagEl.innerHTML = `${tag} <span class="remove-tag" onclick="removeInterest('${tag}')">&times;</span>`;
        interestsContainer.appendChild(tagEl);
    });

    interestsContainer.appendChild(input);
    input.focus();
}

// Make removeInterest global so onclick works
window.removeInterest = removeInterest;

function startSearch() {
    if (isConnected) return;
    setUIState('searching');
    // addSystemMessage('Looking for someone you can chat with...');

    // Offline/UI Testing Mode
    if (typeof io === 'undefined' || (socket && !socket.connected && !socket.io)) {
        console.log("Simulating search (Offline Mode)...");
        setTimeout(() => {
            // Mock partner found
            isInitiator = true;
            isConnected = true;
            setUIState('connected');
            // addSystemMessage('You\'re now chatting with a random stranger. Say Hi!');
        }, 1500);
        return;
    }

    if (socket) {
        socket.emit('find_partner', { interests: interests });
    }
}

function stopChat() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (socket) socket.emit('next');
    isConnected = false;
    addSystemMessage('You have disconnected.');
    setUIState('idle');
    if (remoteVideo) remoteVideo.srcObject = null;
    if (remotePlaceholder) remotePlaceholder.style.display = 'flex';
}

function nextChat() {
    stopChat(); // Reuse stop logic to close current
    // Clear chat for next
    if (chatLog) chatLog.innerHTML = '';
    // Start new search
    startSearch();
}

function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    // Allow if connected OR if in offline simulation
    if (!isConnected && typeof io !== 'undefined') return;

    const senderName = userData ? userData.displayName : 'You';

    if (socket && typeof io !== 'undefined') {
        socket.emit('chat_message', { text: text, sender: senderName });
    }

    addMessage('You', text);
    chatInput.value = '';
}

function createPeerConnection() {
    if (peerConnection) return;
    // Skip WebRTC if offline/mock
    if (typeof io === 'undefined') return;

    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            socket.emit('signal', { candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            if (remotePlaceholder) remotePlaceholder.style.display = 'none';
        }
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
}

// --- UI Helpers ---

function addSystemMessage(text) {
    if (!chatLog) return;
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    chatLog.appendChild(div);
    scrollToBottom();
}

function addMessage(sender, text) {
    if (!chatLog) return;
    const div = document.createElement('div');
    const isMe = sender === 'You';
    div.className = `message ${isMe ? 'you' : 'stranger'}`;
    div.textContent = text;
    chatLog.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function setUIState(state) {
    // Safety check
    if (!startBtn || !stopBtn || !nextBtn) return;

    // Reset common classes
    const disabledClasses = ['opacity-50', 'cursor-not-allowed'];
    const enabledClasses = ['opacity-100', 'cursor-pointer'];

    // Helper to enable/disable
    const setBtn = (btn, enable) => {
        btn.disabled = !enable;
        if (enable) {
            btn.classList.remove(...disabledClasses);
            btn.classList.add(...enabledClasses);
        } else {
            btn.classList.add(...disabledClasses);
            btn.classList.remove(...enabledClasses);
        }
    };

    if (state === 'idle') {
        setBtn(startBtn, true);
        setBtn(stopBtn, false);
        setBtn(nextBtn, false);

        if (connectionStatus) connectionStatus.classList.add('hidden');
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = 'Click START to find a stranger...';
        }
        if (sendBtn) sendBtn.disabled = true;

        if (interestInput) interestInput.disabled = false;

    } else if (state === 'searching') {
        setBtn(startBtn, false);
        setBtn(stopBtn, true);
        setBtn(nextBtn, false);

        if (connectionStatus) {
            connectionStatus.textContent = 'Looking for someone you can chat with...';
            connectionStatus.className = 'flex-shrink-0 text-sm font-medium text-center bg-yellow-50 text-yellow-700 p-3 rounded-xl border border-yellow-100 shadow-sm transition-all duration-300';
            connectionStatus.classList.remove('hidden');
        }

        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = 'Waiting for a stranger...';
        }
        if (sendBtn) sendBtn.disabled = true;

        if (interestInput) interestInput.disabled = true;

        if (remotePlaceholder) remotePlaceholder.style.display = 'flex';
        if (remoteVideo) remoteVideo.srcObject = null;

    } else if (state === 'connected') {
        setBtn(startBtn, false);
        setBtn(stopBtn, true);
        setBtn(nextBtn, true);

        if (connectionStatus) {
            connectionStatus.textContent = 'You\'re now chatting with a random stranger. Say Hi!';
            connectionStatus.className = 'flex-shrink-0 text-sm font-medium text-center bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 shadow-sm transition-all duration-300';
            connectionStatus.classList.remove('hidden');
        }

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type a message...';
            chatInput.focus();
        }
        if (sendBtn) sendBtn.disabled = false;

        if (interestInput) interestInput.disabled = true;

        if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    }
}
