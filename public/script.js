// --- Socket Initialization ---
let socket;
// Socket will be initialized in init()

// --- Variables ---
let localVideo, remoteVideo, chatLog, chatInput, sendBtn, startStopBtn, nextBtn;
let onlineCountNum, remotePlaceholder;
let interestInput, interestsContainer;
let muteBtn, cameraBtn, mirrorBtn;
let audioGainSlider, noiseReductionToggle, gainValueDisplay;
let editProfileBtn, reportBtn, darkModeToggle, settingsBtn;
let editProfileModal, reportModal, settingsModal;
let saveProfileBtn, cancelEditProfileBtn, editNameInput, closeSettingsBtn;
let submitReportBtn, cancelReportBtn, reportReasonInput;
let strangerMenuBtn, strangerMenuDropdown, reportUserAction;
let ageVerificationModal, ageConfirmBtn, ageDenyBtn;

let interests = [];
let localStream;
let peerConnection;
let isInitiator = false;
let isConnected = false;
let userData = null; // Global user data

// Audio Processing Variables
let audioContext;
let mediaStreamSource;
let gainNode;
let destination;

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
    startStopBtn = document.getElementById('start-stop-btn'); // Combined button
    nextBtn = document.getElementById('next-btn');
    onlineCountNum = document.getElementById('online-count-num');
    remotePlaceholder = document.querySelector('#stranger-video-wrapper .video-placeholder');
    interestInput = document.getElementById('interest-input');
    interestsContainer = document.getElementById('interests-container');

    // Media Controls
    muteBtn = document.getElementById('mute-btn');
    cameraBtn = document.getElementById('camera-btn');
    mirrorBtn = document.getElementById('mirror-btn');
    audioGainSlider = document.getElementById('audio-gain-slider');
    gainValueDisplay = document.getElementById('gain-value');
    noiseReductionToggle = document.getElementById('noise-reduction-toggle');

    // Profile & Modals
    // Profile & Modals
    editProfileBtn = document.getElementById('edit-profile-btn');
    // reportBtn = document.getElementById('report-btn'); // Removed old button
    settingsBtn = document.getElementById('settings-btn');
    darkModeToggle = document.getElementById('dark-mode-toggle');
    editProfileModal = document.getElementById('edit-profile-modal');
    reportModal = document.getElementById('report-modal');
    settingsModal = document.getElementById('settings-modal');
    saveProfileBtn = document.getElementById('save-profile');
    cancelEditProfileBtn = document.getElementById('cancel-edit-profile');
    closeSettingsBtn = document.getElementById('close-settings-btn');
    editNameInput = document.getElementById('edit-name-input');
    submitReportBtn = document.getElementById('submit-report');
    cancelReportBtn = document.getElementById('cancel-report');
    reportReasonInput = document.getElementById('report-reason');

    // Menu Elements
    strangerMenuBtn = document.getElementById('stranger-menu-btn');
    strangerMenuDropdown = document.getElementById('stranger-menu-dropdown');
    reportUserAction = document.getElementById('report-user-action');

    // Age Verification Elements
    ageVerificationModal = document.getElementById('age-verification-modal');
    ageConfirmBtn = document.getElementById('age-confirm-btn');
    ageDenyBtn = document.getElementById('age-deny-btn');

    // Check Age Verification
    checkAgeVerification();

    // 2. Attach Event Listeners
    if (startStopBtn) startStopBtn.addEventListener('click', toggleSearch);
    if (nextBtn) nextBtn.addEventListener('click', nextChat);
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (cameraBtn) cameraBtn.addEventListener('click', toggleCamera);
    if (mirrorBtn) mirrorBtn.addEventListener('click', toggleMirror);

    if (audioGainSlider) {
        audioGainSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            setAudioGain(val);
            if (gainValueDisplay) gainValueDisplay.textContent = val.toFixed(1) + 'x';
        });
    }

    if (noiseReductionToggle) {
        noiseReductionToggle.addEventListener('change', (e) => {
            applyAudioConstraints();
        });
    }

    // Modal & Profile Listeners
    if (editProfileBtn) editProfileBtn.addEventListener('click', () => openModal(editProfileModal));
    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal(settingsModal));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));

    // Menu Logic
    if (strangerMenuBtn && strangerMenuDropdown) {
        strangerMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            strangerMenuDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!strangerMenuBtn.contains(e.target) && !strangerMenuDropdown.contains(e.target)) {
                strangerMenuDropdown.classList.add('hidden');
            }
        });
    }

    if (reportUserAction) {
        reportUserAction.addEventListener('click', () => {
            strangerMenuDropdown.classList.add('hidden');
            openModal(reportModal);
        });
    }

    if (cancelEditProfileBtn) cancelEditProfileBtn.addEventListener('click', () => closeModal(editProfileModal));
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => closeModal(reportModal));
    if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => closeModal(reportModal));
    if (submitReportBtn) submitReportBtn.addEventListener('click', submitReport);

    // Age Verification Listeners
    if (ageConfirmBtn) ageConfirmBtn.addEventListener('click', confirmAge);
    if (ageDenyBtn) ageDenyBtn.addEventListener('click', denyAge);

    if (darkModeToggle) {
        // Check saved preference
        if (localStorage.getItem('darkMode') === 'true') {
            document.documentElement.classList.add('dark');
            darkModeToggle.checked = true;
        }

        darkModeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('darkMode', 'true');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('darkMode', 'false');
            }
        });
    }

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
            else if (startStopBtn && !startStopBtn.disabled && startStopBtn.textContent.trim() === 'START') toggleSearch();
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
            updateProfileUI();

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
    await setupMedia();

    // 5. Initial UI State
    setUIState('idle');
}

// --- Media Functions ---

async function setupMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Initialize Audio Context for Gain Control
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
            mediaStreamSource = audioContext.createMediaStreamSource(localStream);
            gainNode = audioContext.createGain();
            destination = audioContext.createMediaStreamDestination();

            mediaStreamSource.connect(gainNode);
            gainNode.connect(destination);

            // Replace the audio track in localStream with the processed one
            // Note: We keep the original video track
            const processedAudioTrack = destination.stream.getAudioTracks()[0];
            const originalAudioTrack = localStream.getAudioTracks()[0];

            localStream.removeTrack(originalAudioTrack);
            localStream.addTrack(processedAudioTrack);

            // Keep original track reference for mute toggling if needed, 
            // but actually we should mute the GAIN node or the new track.
            // Better: Muting the new track works for the remote peer.

        } catch (err) {
            console.error("Web Audio API not supported or failed:", err);
        }

        if (localVideo) {
            localVideo.srcObject = localStream;
            // Mute local video element to prevent feedback, but keep stream active
            localVideo.muted = true;
        }
    } catch (err) {
        console.error("Media error:", err);
        addSystemMessage("Camera/Mic access denied. You can still chat.");
    }
}

function setAudioGain(value) {
    if (gainNode) {
        gainNode.gain.value = value;
    }
}

async function applyAudioConstraints() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const constraints = {
        noiseSuppression: noiseReductionToggle ? noiseReductionToggle.checked : false,
        echoCancellation: true // Always on for chat
    };

    try {
        await audioTrack.applyConstraints(constraints);
        console.log("Applied audio constraints:", constraints);
    } catch (err) {
        console.warn("Failed to apply audio constraints:", err);
    }
}

function toggleMute() {
    if (!localStream) return;
    // Toggle the processed track if using Web Audio, or the original if not
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        // Update Icon
        if (muteBtn) {
            if (audioTrack.enabled) {
                muteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>`;
                muteBtn.classList.remove('bg-red-500');
                muteBtn.classList.add('bg-black/60');
            } else {
                muteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>`;
                muteBtn.classList.remove('bg-black/60');
                muteBtn.classList.add('bg-gray-900');
            }
        }
    }
}

function toggleCamera() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        // Update Icon
        if (cameraBtn) {
            if (videoTrack.enabled) {
                cameraBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
                cameraBtn.classList.remove('bg-red-500');
                cameraBtn.classList.add('bg-black/60');
            } else {
                cameraBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`;
                cameraBtn.classList.remove('bg-black/60');
                cameraBtn.classList.add('bg-gray-900');
            }
        }
    }
}

function toggleMirror() {
    if (localVideo) {
        localVideo.classList.toggle('mirror-mode');
        // Optional: Update icon state if desired
    }
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

function toggleSearch() {
    if (!startStopBtn) return;

    if (startStopBtn.textContent.trim() === 'START') {
        startSearch();
    } else {
        stopChat();
    }
}

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
    if (!startStopBtn || !nextBtn) return;

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
        // Start Button
        startStopBtn.textContent = 'START';
        startStopBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        startStopBtn.classList.add('bg-orange-600', 'hover:bg-orange-700', 'shadow-orange-200');
        setBtn(startStopBtn, true);

        setBtn(nextBtn, false);

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type a message...';
        }
        if (sendBtn) sendBtn.disabled = true;

        if (interestInput) interestInput.disabled = false;

    } else if (state === 'searching') {
        // Stop Button
        startStopBtn.textContent = 'STOP';
        startStopBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700', 'shadow-orange-200');
        startStopBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        setBtn(startStopBtn, true);

        setBtn(nextBtn, false);

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Waiting for a stranger...';
        }
        if (sendBtn) sendBtn.disabled = true;

        // Allow editing interests while searching
        if (interestInput) interestInput.disabled = false;

        if (remotePlaceholder) remotePlaceholder.style.display = 'flex';
        if (remoteVideo) remoteVideo.srcObject = null;

    } else if (state === 'connected') {
        // Stop Button
        startStopBtn.textContent = 'STOP';
        startStopBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700', 'shadow-orange-200');
        startStopBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        setBtn(startStopBtn, true);

        setBtn(nextBtn, true);

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type a message...';
            chatInput.focus();
        }
        if (sendBtn) sendBtn.disabled = false;

        if (interestInput) interestInput.disabled = false;

        if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    }
}

// --- Profile & Modal Functions ---

function updateProfileUI() {
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');

    if (userNameEl && userData) userNameEl.textContent = userData.displayName;
    if (userAvatarEl && userData && userData.photoURL) userAvatarEl.src = userData.photoURL;
}

function openModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        if (modal === editProfileModal && editNameInput && userData) {
            editNameInput.value = userData.displayName;
        }
    }
}

function closeModal(modal) {
    if (modal) modal.classList.add('hidden');
}

function saveProfile() {
    if (editNameInput && userData) {
        const newName = editNameInput.value.trim();
        if (newName) {
            userData.displayName = newName;
            updateProfileUI();
            // In a real app, send update to server here
            closeModal(editProfileModal);
        }
    }
}

function submitReport() {
    if (reportReasonInput) {
        const reason = reportReasonInput.value.trim();
        if (reason) {
            console.log("Report submitted:", reason);
            // In a real app, send report to server
            alert("Report submitted successfully.");
            reportReasonInput.value = '';
            closeModal(reportModal);
        }
    }
}

// --- Age Verification Functions ---

function checkAgeVerification() {
    const isVerified = localStorage.getItem('ageVerified');
    if (isVerified !== 'true') {
        // Show modal
        if (ageVerificationModal) {
            ageVerificationModal.classList.remove('hidden');
        }
    }
}

function confirmAge() {
    localStorage.setItem('ageVerified', 'true');
    if (ageVerificationModal) {
        ageVerificationModal.classList.add('hidden');
    }
}

function denyAge() {
    window.location.href = 'https://www.google.com';
}
