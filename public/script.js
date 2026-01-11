const socket = io();

// UI Elements
const landingPage = document.getElementById('landing-page');
const videoChatContainer = document.getElementById('video-chat-container');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const skipBtn = document.getElementById('skip-btn');
const liveCountSpan = document.getElementById('live-count');
const genderBtns = document.querySelectorAll('.filter-btn');
const countrySelect = document.getElementById('country-filter');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const loadingSpinner = document.getElementById('loading-spinner');
const strangerInfo = document.getElementById('stranger-info');
const strangerFlag = document.getElementById('stranger-flag');
const strangerStatus = document.getElementById('stranger-status');

const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const interestInput = document.getElementById('interest-tags');
const chatOverlay = document.querySelector('.chat-overlay');

// State
let localStream;
let peerConnection;
let currentPartnerId = null;
let isSearching = false;
let myGender = 'male'; // Default or from profile
let filterGender = 'all';
let filterCountry = 'Global';

let isVip = false;

// WebRTC Config
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// --- Event Listeners ---

// Mic Toggle
if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                micBtn.classList.toggle('off', !audioTrack.enabled);
                micBtn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            }
        }
    });
}

// Camera Toggle
if (camBtn) {
    camBtn.addEventListener('click', () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                camBtn.classList.toggle('off', !videoTrack.enabled);
                camBtn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            }
        }
    });
}

// Chat Toggle
if (chatToggleBtn && chatOverlay) {
    chatToggleBtn.addEventListener('click', () => {
        chatOverlay.classList.toggle('hidden');
        const isHidden = chatOverlay.classList.contains('hidden');
        chatToggleBtn.classList.toggle('off', isHidden);
        chatToggleBtn.innerHTML = isHidden ? '<i class="fas fa-comment-slash"></i>' : '<i class="fas fa-comment"></i>';
    });
}

// Gender Selection
genderBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const selectedGender = btn.dataset.gender;

        if (selectedGender !== 'all' && !isVip) {
            alert("Gender filtering is for VIPs only! Please upgrade.");
            // Open sidebar to show upgrade option
            sidebar.classList.add('active');
            sidebarOverlay.classList.remove('hidden');
            return;
        }

        genderBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterGender = selectedGender;
    });
});

// Start Chat - Trigger Flow
startBtn.addEventListener('click', () => {
    const auth = JSON.parse(localStorage.getItem('skipsee_auth') || '{"isLoggedIn": false}');

    if (!auth.isLoggedIn) {
        // Step 1: Login
        pendingChatStart = true;
        profileModalOverlay.classList.remove('hidden');
    } else {
        // Already logged in? Go straight to Gender check
        showGenderModal();
    }
});

// Stop Chat
stopBtn.addEventListener('click', () => {
    stopSearchOrChat();
    stopCamera();
    landingPage.classList.remove('hidden');
    videoChatContainer.classList.add('hidden');
});

// Skip
skipBtn.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    socket.emit('skip');
    // UI Updates
    remoteVideo.srcObject = null;
    strangerInfo.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    chatMessages.innerHTML = '';

    // Auto-requeue logic handled by server or implicit state? 
    // Server expects us to be in search mode again if we skipped?
    // In server logic: skipping mostly disconnects. We need to explicitly search again.
    startSearch();
});

// Sidebar
menuBtn.addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarOverlay.classList.remove('hidden');
});
const closeSidebar = () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.add('hidden');
};
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Chat
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = msgInput.value.trim();
    if (text && currentPartnerId) {
        // Add to UI
        addMessage(text, true);
        // Send
        socket.emit('message', { message: text });
        msgInput.value = '';
    }
}

function addMessage(text, isMine) {
    const div = document.createElement('div');
    div.classList.add('message-bubble');
    if (isMine) div.classList.add('mine');
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}



// --- Logic ---

// Audio Context for Mic Gain
let audioContext;
let micSource;
let micGainNode;

async function startCamera() {
    if (!localStream) {
        try {
            // 1. Get Raw Stream
            const rawStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            // 2. Setup Audio Processing
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(rawStream);
            micGainNode = audioContext.createGain();
            micGainNode.gain.value = 1.0; // Default

            const destination = audioContext.createMediaStreamDestination();
            source.connect(micGainNode);
            micGainNode.connect(destination);

            // 3. Create Final Local Stream with Processed Audio + Raw Video
            const processedAudioTrack = destination.stream.getAudioTracks()[0];
            const videoTrack = rawStream.getVideoTracks()[0];

            // Global localStream used for WebRTC
            localStream = new MediaStream([videoTrack, processedAudioTrack]);

            // 4. Local Video Preview (mute audio locally)
            localVideo.srcObject = new MediaStream([videoTrack]);

        } catch (e) {
            console.error("Audio/Camera setup failed", e);
            alert("Could not access camera/microphone. Please check permissions.");
        }
    }
}

// Volume Sliders
const micVolumeSlider = document.getElementById('mic-volume');
const speakerVolumeSlider = document.getElementById('speaker-volume');

if (micVolumeSlider) {
    micVolumeSlider.addEventListener('input', (e) => {
        if (micGainNode) micGainNode.gain.value = e.target.value;
    });
}

if (speakerVolumeSlider) {
    speakerVolumeSlider.addEventListener('input', (e) => {
        // console.log("Speaker Vol:", e.target.value);
        if (remoteVideo) remoteVideo.volume = parseFloat(e.target.value);
    });
}

// Match History Logic
function addToHistory(partnerData) {
    let history = JSON.parse(localStorage.getItem('skipsee_history') || '[]');
    history.unshift(partnerData);
    if (history.length > 50) history.pop();
    localStorage.setItem('skipsee_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('match-history-list');
    if (!list) return;

    const history = JSON.parse(localStorage.getItem('skipsee_history') || '[]');

    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">No matches yet</div>';
        return;
    }

    list.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-avatar">${item.flag || '👤'}</div>
            <div class="history-info">
                <div class="history-name">${item.name}, ${item.age}</div>
                <div class="history-time">${item.time}</div>
            </div>
        `;
        list.appendChild(div);
    });
}

// Initial Render
renderHistory();

// Subscription Mock Logic
// isVip is now global
const subPanel = document.getElementById('subscription-panel');
// Use event delegation or check if element exists (it's inside sidebar content now)
// We need to re-select after HTML update or just use a delegated listener on body if preferred, 
// but since we updated HTML, we should be able to select it if this script runs AFTER HTML.
// script.js is at end of body, so it's fine.
const upgradeBtn = document.querySelector('.upgrade-btn');

if (upgradeBtn) {
    // New Logic: Open Pricing Modal
    upgradeBtn.addEventListener('click', () => {
        pricingModalOverlay.classList.remove('hidden');
        sidebar.classList.remove('active');
        sidebarOverlay.classList.add('hidden');
    });
}

// --- Razorpay Payment Logic ---
const pricingModalOverlay = document.getElementById('pricing-modal-overlay');
const closePricingBtn = document.getElementById('close-pricing-btn');
const planSelectBtns = document.querySelectorAll('.plan-select-btn');

if (closePricingBtn) {
    closePricingBtn.addEventListener('click', () => {
        pricingModalOverlay.classList.add('hidden');
    });
}

if (pricingModalOverlay) {
    pricingModalOverlay.addEventListener('click', (e) => {
        if (e.target === pricingModalOverlay) pricingModalOverlay.classList.add('hidden');
    });
}

planSelectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = btn.dataset.amount;
        const planName = btn.dataset.plan;

        const options = {
            "key": "rzp_test_S1oREicOujDoxT",
            "amount": amount,
            "currency": "INR",
            "name": "Skipsee VIP",
            "description": `Upgrade to ${planName}`,
            "image": "Skipsee-4.svg",
            "handler": function (response) {
                // Payment Success
                console.log("Payment ID: " + response.razorpay_payment_id);
                isVip = true;
                localStorage.setItem('skipsee_is_vip', 'true');
                updateSubscriptionUI();
                pricingModalOverlay.classList.add('hidden');
                alert(`Payment Successful! Access granted to ${planName}.`);
            },
            "prefill": {
                "name": typeof profileName !== 'undefined' ? profileName.innerText : "User",
                "email": "user@example.com",
                "contact": "9999999999"
            },
            "theme": {
                "color": "#FF3458"
            }
        };

        try {
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.description);
            });
            rzp.open();
        } catch (e) {
            console.error("Razorpay Error:", e);
            alert("Could not initialize payment. Ensure internet access.");
        }
    });
});

// Check saved VIP status on load
const savedVip = localStorage.getItem('skipsee_is_vip');
if (savedVip === 'true') {
    isVip = true;
    updateSubscriptionUI();
}

function updateSubscriptionUI() {
    if (isVip) {
        subPanel.innerHTML = `
            <div class="sub-card" style="border-color: #00ff88;">
                <div class="sub-icon" style="color: #00ff88;"><i class="fas fa-check-circle"></i></div>
                <div class="sub-info">
                    <h4 style="color: #00ff88;">VIP Active</h4>
                    <p>All filters unlocked. Unlimited skips.</p>
                </div>
            </div>
        `;
        // Unlock filters visually
        countrySelect.disabled = false;
        genderBtns.forEach(btn => btn.style.pointerEvents = 'auto');

        // Remove Lock Icons
        document.querySelectorAll('.lock-icon').forEach(icon => icon.style.display = 'none');
    } else {
        // Lock filters visually if we wanted to be strict
        // countrySelect.disabled = true;
    }
}

// --- Profile & Auth Logic ---
const profileModalOverlay = document.getElementById('profile-modal-overlay');
const userAvatarBtn = document.getElementById('user-avatar-btn');
const closeProfileBtn = document.getElementById('close-profile-btn');

const loginOptions = document.getElementById('login-options');
const loggedInOptions = document.getElementById('logged-in-options');
const profileName = document.getElementById('profile-name');
const googleBtn = document.querySelector('.google-btn');
const guestBtn = document.querySelector('.guest-btn');
const itemLogoutBtn = document.querySelector('.logout-btn-modal');

// New Landing Elements
const landingProfileBtn = document.getElementById('landing-profile-btn');
const landingAvatar = document.getElementById('landing-avatar');
const landingUsername = document.getElementById('landing-username');

function updateAuthUI(name, avatarUrl, isLoggedIn) {
    if (isLoggedIn) {
        profileName.innerText = name;
        loginOptions.classList.add('hidden');
        loggedInOptions.classList.remove('hidden');

        // Update all avatars
        document.querySelectorAll('.user-avatar, .profile-avatar-lg, .user-avatar-sm').forEach(img => img.src = avatarUrl);

        if (landingUsername) landingUsername.innerText = name;
    } else {
        // Reset Logic if needed (or just keep default)
        if (landingUsername) landingUsername.innerText = "Login";
    }
}

// Check Auth State on Load
const authState = JSON.parse(localStorage.getItem('skipsee_auth') || '{"isLoggedIn": false}');
if (authState.isLoggedIn) {
    updateAuthUI(authState.name, authState.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest", true);
}

// Toggle Modal
if (userAvatarBtn) {
    userAvatarBtn.addEventListener('click', () => {
        profileModalOverlay.classList.remove('hidden');
    });
}

if (landingProfileBtn) {
    landingProfileBtn.addEventListener('click', () => {
        profileModalOverlay.classList.remove('hidden');
    });
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => {
        profileModalOverlay.classList.add('hidden');
    });
}

profileModalOverlay.addEventListener('click', (e) => {
    if (e.target === profileModalOverlay) {
        profileModalOverlay.classList.add('hidden');
    }
});

// --- Sequential Start Flow & Auth ---

// Modal Elements
const genderModalOverlay = document.getElementById('gender-modal-overlay');
const ageModalOverlay = document.getElementById('age-modal-overlay');
const ageConfirmBtn = document.getElementById('age-confirm-btn');
const ageDenyBtn = document.getElementById('age-deny-btn');
const genderSelectBtns = document.querySelectorAll('.gender-select-btn');

let pendingChatStart = false;

// 1. Centralized Login Handler (No Reload)
function handleLogin(type, userData = null) {
    let name = 'Guest User';
    let avatarUrl = "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest";

    if (type === 'google' && userData) {
        name = userData.name;
        avatarUrl = userData.picture;
    } else if (type === 'google' && !userData) {
        // Fallback if no data passed (shouldn't happen with real flow)
        name = 'Google User';
        avatarUrl = "https://api.dicebear.com/7.x/avataaars/svg?seed=GoogleUser";
    }

    const newState = { isLoggedIn: true, type, name, avatar: avatarUrl };
    localStorage.setItem('skipsee_auth', JSON.stringify(newState));

    updateAuthUI(name, avatarUrl, true);

    profileModalOverlay.classList.add('hidden');

    // If flow triggered by Start button, continue
    if (pendingChatStart) {
        pendingChatStart = false; // Reset flag
        showGenderModal();
    }
}

// Google Auth Initialization
let tokenClient;
let GOOGLE_CLIENT_ID = null;

async function initGoogleAuth() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        GOOGLE_CLIENT_ID = config.googleClientId;

        if (typeof google !== 'undefined' && google.accounts && GOOGLE_CLIENT_ID) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'profile email',
                callback: (response) => {
                    if (response.access_token) {
                        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${response.access_token}` }
                        })
                            .then(res => res.json())
                            .then(info => {
                                handleLogin('google', info);
                            })
                            .catch(err => {
                                console.error("Google User Info Error:", err);
                                alert("Failed to get Google profile.");
                            });
                    }
                },
            });
        }
    } catch (e) {
        console.error("Failed to load config:", e);
    }
}

window.onload = function () {
    if (typeof google === 'undefined') {
        console.warn("Google Identity Services script not loaded.");
    }
    // Initialize Auth
    initGoogleAuth();
};

// Login Listeners
if (googleBtn) {
    googleBtn.onclick = () => {
        if (!GOOGLE_CLIENT_ID) {
            alert("Google Client ID not configured on server.");
            return;
        }

        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            // Re-try init if it failed earlier or script loaded late
            initGoogleAuth().then(() => {
                if (tokenClient) tokenClient.requestAccessToken();
                else alert("Google Sign-In not ready. Check internet connection.");
            });
        }
    };
}

if (guestBtn) {
    guestBtn.onclick = () => handleLogin('guest');
}

// Logout Listener
if (itemLogoutBtn) {
    itemLogoutBtn.onclick = () => {
        localStorage.removeItem('skipsee_auth');
        window.location.reload();
    };
}

// 2. Start Button Flow Interceptor
// We remove the old listener by replacing the element clone or just managing the logic.
// Since we can't easily remove anonymous listeners, we'll update the Start Button logic 
// by changing the existing listener (in next step) or using a flag. 
// Ideally we replace the code block where the start listener was defined.

// Step 2: Gender Selection
function showGenderModal() {
    genderModalOverlay.classList.remove('hidden');
}

genderSelectBtns.forEach(btn => {
    btn.onclick = () => {
        myGender = btn.dataset.gender;
        genderModalOverlay.classList.add('hidden');
        showAgeModal();
    };
});

// Step 3: Age Verification
function showAgeModal() {
    ageModalOverlay.classList.remove('hidden');
}

if (ageConfirmBtn) {
    ageConfirmBtn.onclick = () => {
        ageModalOverlay.classList.add('hidden');
        initiateVideoChat();
    };
}

if (ageDenyBtn) {
    ageDenyBtn.onclick = () => {
        alert("You must be 18+ to enter.");
        ageModalOverlay.classList.add('hidden');
    };
}

// Final Step: Actual Start
async function initiateVideoChat() {
    try {
        await startCamera();

        // Reset Toggle Buttons via UI Logic
        if (micBtn) {
            micBtn.classList.remove('off');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        if (camBtn) {
            camBtn.classList.remove('off');
            camBtn.innerHTML = '<i class="fas fa-video"></i>';
        }

        landingPage.classList.add('hidden');
        videoChatContainer.classList.remove('hidden');
        startSearch();
    } catch (err) {
        alert('Camera access denied or error: ' + err.message);
    }
}

function stopCamera() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
}

function startSearch() {
    isSearching = true;
    loadingSpinner.classList.remove('hidden');
    filterCountry = countrySelect.value;

    // Parse Interests
    let interests = [];
    if (interestInput) {
        interests = interestInput.value.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    }

    socket.emit('start-search', {
        gender: filterGender,
        country: filterCountry,
        interests: interests
    });
}

function stopSearchOrChat() {
    isSearching = false;
    socket.emit('stop-search');
    socket.emit('skip'); // Ensure disconnection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    chatMessages.innerHTML = '';
}

// --- Socket Events ---

socket.on('online-count', (count) => {
    liveCountSpan.innerText = count;
});

socket.on('match-found', async (data) => {
    // data: { initiator, partnerId, country }
    console.log('Match found!', data);

    loadingSpinner.classList.add('hidden');
    strangerInfo.classList.remove('hidden');

    // Map country code to flag
    const countryMap = { 'US': '🇺🇸', 'IN': '🇮🇳', 'UK': '🇬🇧', 'Global': '🌍' };
    const flag = countryMap[data.country] || '🌍';

    // Generate Random Name for Stranger
    const names = ["Alex", "Sarah", "Mike", "Emma", "John", "Jess", "David", "Anna", "Tom", "Sofia"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomAge = Math.floor(Math.random() * (30 - 18 + 1)) + 18;

    strangerStatus.innerHTML = `${flag} <strong>${randomName}, ${randomAge}</strong> <span style="font-size:0.8em; opacity:0.8; margin-left:5px">• Connected</span>`;

    // Add to History
    addToHistory({
        name: randomName,
        age: randomAge,
        flag: flag,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    currentPartnerId = data.partnerId;

    createPeerConnection(data.partnerId);

    if (data.initiator) {
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', { target: data.partnerId, sdp: offer });
        } catch (e) {
            console.error(e);
        }
    }
});

socket.on('partner-disconnected', () => {
    // Partner left
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    currentPartnerId = null;

    // Automatically search for new match
    strangerInfo.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    chatMessages.innerHTML = '';

    startSearch();
});

socket.on('offer', async (data) => {
    // CRITICAL FIX: Use currentPartnerId, not data.target (which is me)
    if (!peerConnection) {
        if (currentPartnerId) {
            createPeerConnection(currentPartnerId);
        } else {
            console.error("Received offer but no partner ID known!");
            return;
        }
    }

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // CRITICAL FIX: Send answer to PARTNER
        socket.emit('answer', { target: currentPartnerId, sdp: answer });
    } catch (e) {
        console.error(e);
    }
});

socket.on('answer', async (data) => {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
});

socket.on('ice-candidate', async (data) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) { console.error(e); }
    }
});

socket.on('message', (data) => {
    if (data.sender === 'stranger') {
        addMessage(data.message, false);
    }
});

// --- WebRTC Helper ---

function createPeerConnection(partnerSocketId) {
    if (peerConnection) peerConnection.close();

    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: partnerSocketId, candidate: event.candidate });
        }
    };
}

// --- Draggable PIP ---
const pipElement = document.getElementById('local-video-wrapper');
let isDragging = false;
let startX, startY, initialLeft, initialTop;

pipElement.addEventListener('mousedown', dragStart);
pipElement.addEventListener('touchstart', dragStart, { passive: false });

function dragStart(e) {
    if (e.target.tagName === 'VIDEO') return; // Allow clicking video? No, usually dragging wrapper.
    // Actually wrapper catches it.

    initialLeft = pipElement.offsetLeft;
    initialTop = pipElement.offsetTop;

    if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    } else {
        startX = e.clientX;
        startY = e.clientY;
    }

    isDragging = true;

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();

    let clientX, clientY;
    if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const dx = clientX - startX;
    const dy = clientY - startY;

    pipElement.style.left = `${initialLeft + dx}px`;
    pipElement.style.top = `${initialTop + dy}px`;
}

function dragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);
}
