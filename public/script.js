// --- Socket Initialization ---
let socket;
// Socket will be initialized in init()

// --- Variables ---
let localVideo, remoteVideo, chatLog, chatInput, sendBtn, startStopBtn, nextBtn;
let onlineCountNum, remotePlaceholder;
let interestInput, interestsContainer;
let muteBtn, cameraBtn;
let audioGainSlider, noiseReductionToggle, gainValueDisplay;
let reportBtn, darkModeToggle, settingsBtn, userProfileBtn, userProfileDropdown;
let reportModal, settingsModal;
let saveProfileBtn, editNameInput, closeSettingsBtn;
let submitReportBtn, cancelReportBtn, reportReasonInput;
let strangerMenuBtn, strangerMenuDropdown, reportUserAction;
let ageVerificationModal, ageConfirmBtn, ageDenyBtn;

let interests = [];
let localStream;
let peerConnection;
let isInitiator = false;
let isConnected = false;
let userData = null; // Global user data
let connectionTimeout;
let isNextDebounced = false;

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
    audioGainSlider = document.getElementById('audio-gain-slider');
    gainValueDisplay = document.getElementById('gain-value');
    noiseReductionToggle = document.getElementById('noise-reduction-toggle');

    // Profile & Modals
    // Profile & Modals

    // reportBtn = document.getElementById('report-btn'); // Removed old button
    settingsBtn = document.getElementById('settings-btn');
    darkModeToggle = document.getElementById('dark-mode-toggle');

    reportModal = document.getElementById('report-modal');
    settingsModal = document.getElementById('settings-modal');
    saveProfileBtn = document.getElementById('save-profile');

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
    // checkAgeVerification(); // Moved to after user fetch

    // 2. Attach Event Listeners
    if (startStopBtn) startStopBtn.addEventListener('click', toggleSearch);
    if (nextBtn) nextBtn.addEventListener('click', nextChat);
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (cameraBtn) cameraBtn.addEventListener('click', toggleCamera);

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

    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal(settingsModal));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));

    // Profile Dropdown Logic
    userProfileBtn = document.getElementById('user-profile');
    userProfileDropdown = document.getElementById('user-profile-dropdown');

    if (userProfileBtn && userProfileDropdown) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userProfileDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!userProfileBtn.contains(e.target) && !userProfileDropdown.contains(e.target)) {
                userProfileDropdown.classList.add('hidden');
            }
        });
    }

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
            socket.on('connect', () => {
                console.log("Socket connected!");
                if (onlineCountNum) onlineCountNum.parentElement.classList.add('bg-green-100', 'text-green-800');
            });

            socket.on('disconnect', () => {
                console.log("Socket disconnected!");
                if (onlineCountNum) onlineCountNum.parentElement.classList.remove('bg-green-100', 'text-green-800');
                addSystemMessage("Lost connection to server.");
            });

            socket.on('user_count', (count) => {
                if (onlineCountNum) onlineCountNum.textContent = count.toLocaleString();
            });

            socket.on('partner_found', async ({ initiator, commonInterests, partnerId, partnerCountry, partnerFlag }) => {
                isInitiator = initiator;
                isConnected = true;
                currentPartnerId = partnerId; // Store partner ID for blocking
                setUIState('connected');

                // Update UI with partner country
                const strangerCountryEl = document.getElementById('stranger-country');
                const strangerFlagEl = document.getElementById('stranger-flag');

                if (strangerCountryEl) strangerCountryEl.textContent = partnerCountry || 'Global';
                if (strangerFlagEl) strangerFlagEl.textContent = partnerFlag || '🌐';

                if (commonInterests && commonInterests.length > 0) {
                    addSystemMessage(`You matched on interests: ${commonInterests.join(', ')}`);
                } else {
                    // addSystemMessage('You\'re now chatting with a random stranger. Say Hi!');
                }

                createPeerConnection();

                // Start Connection Timeout
                if (connectionTimeout) clearTimeout(connectionTimeout);
                connectionTimeout = setTimeout(() => {
                    if (peerConnection && peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
                        addSystemMessage("Connection taking too long. Click 'Next' to try someone else.");
                    }
                }, 10000); // 10 seconds

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
                photoURL: data.user.photo || null,
                ageVerified: data.ageVerified // Get from backend
            };
            console.log("Logged in as:", userData.displayName);

            // Update UI
            updateProfileUI();

            // Check Age Verification (Now that we have user data)
            checkAgeVerification();

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

    // 4. Media Setup
    await setupMedia();

    // 5. Fetch Location logic
    try {
        const geoExp = await fetch('https://ipapi.co/json/');
        if (geoExp.ok) {
            const geoData = await geoExp.json();
            if (userData) {
                userData.country = geoData.country_name;
                userData.countryCode = geoData.country_code;
                userData.flag = getFlagEmoji(geoData.country_code);

                // Update local UI
                const localFlagEl = document.getElementById('local-flag');
                if (localFlagEl) localFlagEl.textContent = userData.flag;
            }
        }
    } catch (e) {
        console.warn("Location fetch failed:", e);
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

    // 6. Initial UI State
    setUIState('idle');
}

function getFlagEmoji(countryCode) {
    if (!countryCode) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
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
        addSystemMessage("Error accessing camera/microphone: " + err.message);
        addSystemMessage("Please ensure you have allowed camera access and no other app is using it.");
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
            const slashIcon = muteBtn.querySelector('.slash-icon');
            if (audioTrack.enabled) {
                if (slashIcon) slashIcon.classList.add('hidden');
                muteBtn.classList.remove('bg-red-500');
                muteBtn.classList.add('bg-black/60');
            } else {
                if (slashIcon) slashIcon.classList.remove('hidden');
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
            const slashIcon = cameraBtn.querySelector('.slash-icon');
            if (videoTrack.enabled) {
                if (slashIcon) slashIcon.classList.add('hidden');
                cameraBtn.classList.remove('bg-red-500');
                cameraBtn.classList.add('bg-black/60');
            } else {
                if (slashIcon) slashIcon.classList.remove('hidden');
                cameraBtn.classList.remove('bg-black/60');
                cameraBtn.classList.add('bg-gray-900');
            }
        }
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

    // Block User Logic
    let blockedUserIds = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    let currentPartnerId = null;

    const blockUserAction = document.getElementById('block-user-action');

    if (blockUserAction) {
        blockUserAction.addEventListener('click', () => {
            if (currentPartnerId) {
                if (!blockedUserIds.includes(currentPartnerId)) {
                    blockedUserIds.push(currentPartnerId);
                    localStorage.setItem('blockedUsers', JSON.stringify(blockedUserIds));
                    addSystemMessage("User blocked. You won't meet them again.");
                }
                nextChat();
            } else {
                addSystemMessage("No user to block.");
            }
            strangerMenuDropdown.classList.add('hidden');
        });
    }

    if (socket) {
        socket.emit('find_partner', { interests: interests, blocked: blockedUserIds });
    }
}

function stopChat() {
    if (connectionTimeout) clearTimeout(connectionTimeout);
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (socket) socket.emit('next');
    isConnected = false;
    currentPartnerId = null;
    addSystemMessage('You have disconnected.');
    setUIState('idle');
    if (remoteVideo) remoteVideo.srcObject = null;
    if (remotePlaceholder) remotePlaceholder.style.display = 'flex';

    // Reset Stranger UI
    const strangerCountryEl = document.getElementById('stranger-country');
    const strangerFlagEl = document.getElementById('stranger-flag');
    if (strangerCountryEl) strangerCountryEl.textContent = 'Global';
    if (strangerFlagEl) strangerFlagEl.textContent = '🌐';
}

function nextChat() {
    if (isNextDebounced) return;
    isNextDebounced = true;
    setTimeout(() => isNextDebounced = false, 500); // 500ms debounce

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

    console.log("Creating RTCPeerConnection");
    addSystemMessage("Establishing video connection...");

    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            console.log("Sending ICE candidate");
            socket.emit('signal', { candidate: event.candidate });
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE State:", peerConnection.iceConnectionState);
        // addSystemMessage("Connection state: " + peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
            if (connectionTimeout) clearTimeout(connectionTimeout);
            if (remotePlaceholder) remotePlaceholder.style.display = 'none';
        } else if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
            addSystemMessage("Connection failed or disconnected.");
        }
    };

    peerConnection.ontrack = (event) => {
        console.log("Received remote track");
        if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            if (remotePlaceholder) remotePlaceholder.style.display = 'none';
            addSystemMessage("Video connected!");
        }
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    } else {
        addSystemMessage("Warning: No local video/audio stream to send.");
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
        if (modal === settingsModal && editNameInput && userData) {
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
    // If user is not logged in (guest), we might still want to show it, 
    // but for now the requirement is "every time new user login".
    // If userData is present, check the backend flag.

    if (userData && !userData.ageVerified) {
        if (ageVerificationModal) {
            ageVerificationModal.classList.remove('hidden');
        }
    }
}

async function confirmAge() {
    try {
        const res = await fetch('/api/verify-age', { method: 'POST' });
        if (res.ok) {
            if (userData) userData.ageVerified = true;
            if (ageVerificationModal) {
                ageVerificationModal.classList.add('hidden');
            }
        } else {
            console.error("Failed to verify age with backend");
        }
    } catch (e) {
        console.error("Error verifying age:", e);
    }
}

function denyAge() {
    window.location.href = 'https://www.google.com';
}
