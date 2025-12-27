// --- Socket Initialization ---
let socket;
// Socket will be initialized in init()

// --- Variables ---
let localVideo, remoteVideo, chatLog, chatInput, sendBtn, startStopBtn, nextBtn;
let onlineCountNum, remotePlaceholder, pipContainer, homeGrid;
let interestInput, interestsContainer;
let muteBtn, cameraBtn;
let audioGainSlider, noiseReductionToggle, gainValueDisplay;
let reportBtn, darkModeToggle, settingsBtn, userProfileBtn, userProfileDropdown;
let reportModal, settingsModal;
let saveProfileBtn, editNameInput, closeSettingsBtn;
let submitReportBtn, cancelReportBtn, reportReasonInput;
let strangerMenuBtn, strangerMenuDropdown, reportUserAction, blockUserAction;
let currentPartnerId = null;
let ageVerificationModal, ageConfirmBtn, ageDenyBtn;
let genderModal, selectGenderMale, selectGenderFemale;
let shopModal, closeShopBtn, watchAdBtn, exchangeCoinsBtn, buyDiamondsBtn;
let limitModal, openShopLimitBtn;
let coinBalanceDisplay, creditCountDisplay;

let interests = [];
let localStream;
let peerConnection;
let isInitiator = false;
let isConnected = false;
let userData = null; // Global user data
let connectionTimeout;
let isNextDebounced = false;
let originalAudioTrack; // Added for noise suppression access

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

    // 0. Fetch User Data
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            const data = await res.json();
            userData = data.user;
            console.log("User Data Loaded:", userData);

            // Update UI with initial data
            if (userData) {
                if (userData.countryCode) {
                    userData.flag = getFlagEmoji(userData.countryCode);
                    const localFlagEl = document.getElementById('local-flag');
                    if (localFlagEl) localFlagEl.textContent = userData.flag;
                }
                updateShopPrices(userData.countryCode);
                updateProfileUI();
                if (coinBalanceDisplay) coinBalanceDisplay.innerText = userData.coins || 0;
            }

            // Check Age Verification
            checkAgeVerification();
        } else {
            console.warn("Failed to fetch user data.");
        }
    } catch (e) {
        console.error("Error fetching user data:", e);
    }

    // 1. Select DOM Elements
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    chatLog = document.getElementById('chat-log');
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    startStopBtn = document.getElementById('start-stop-btn'); // Combined button
    nextBtn = document.getElementById('next-btn');
    onlineCountNum = document.getElementById('online-count-num');

    // --- Mobile Buttons ---
    // --- Sidebar / Chat Toggle (Mobile) ---
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebarPanel = document.getElementById('sidebar-panel');

    if (chatToggleBtn && sidebarPanel) {
        chatToggleBtn.addEventListener('click', () => {
            sidebarPanel.classList.remove('hidden');
            // Small delay to allow display block to render before transition
            setTimeout(() => {
                sidebarPanel.classList.remove('translate-x-full');
            }, 10);
        });
    }

    if (closeSidebarBtn && sidebarPanel) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebarPanel.classList.add('translate-x-full');
            setTimeout(() => {
                sidebarPanel.classList.add('hidden');
            }, 300); // Wait for transition
        });
    }

    // --- Mobile Buttons ---
    const mobileStartBtn = document.getElementById('mobile-start-btn');
    const mobileNextBtn = document.getElementById('mobile-next-btn');

    // Wire up Mobile Buttons (Mirror Desktop)
    if (mobileStartBtn) mobileStartBtn.addEventListener('click', () => {
        if (startStopBtn) startStopBtn.click();
    });

    if (mobileNextBtn) mobileNextBtn.addEventListener('click', () => {
        if (nextBtn) nextBtn.click();
    });

    remotePlaceholder = document.querySelector('#stranger-video-wrapper .video-placeholder');
    interestInput = document.getElementById('interest-input');
    interestsContainer = document.getElementById('interests-container');

    // Media Controls
    muteBtn = document.getElementById('mute-toggle-pip') || document.getElementById('mute-btn');
    cameraBtn = document.getElementById('camera-toggle-pip') || document.getElementById('camera-btn');
    audioGainSlider = document.getElementById('audio-gain-slider');
    gainValueDisplay = document.getElementById('gain-value');
    noiseReductionToggle = document.getElementById('noise-reduction-toggle');

    // Layout Elements
    pipContainer = document.getElementById('pip-container');
    homeGrid = document.getElementById('home-grid-overlay');

    // Toolbar Buttons
    interestsBtn = document.getElementById('interests-btn');

    // Profile & Modals
    // Profile & Modals

    // reportBtn = document.getElementById('report-btn'); // Removed old button
    settingsBtn = document.getElementById('settings-btn');

    reportModal = document.getElementById('report-modal');
    settingsModal = document.getElementById('settings-modal');
    saveProfileBtn = document.getElementById('save-profile');

    closeSettingsBtn = document.getElementById('close-settings-btn');
    editNameInput = document.getElementById('edit-name-input');
    submitReportBtn = document.getElementById('submit-report');
    cancelReportBtn = document.getElementById('cancel-report');
    reportReasonInput = document.getElementById('report-reason');

    // Login Modal
    loginModal = document.getElementById('login-modal');
    closeLoginModalBtn = document.getElementById('close-login-modal');
    if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', () => closeModal(loginModal));

    // Menu Elements
    strangerMenuBtn = document.getElementById('stranger-menu-btn');
    strangerMenuDropdown = document.getElementById('stranger-menu-dropdown');
    reportUserAction = document.getElementById('report-user-action');
    blockUserAction = document.getElementById('block-user-action');

    // Age Verification Elements
    ageVerificationModal = document.getElementById('age-verification-modal');
    ageConfirmBtn = document.getElementById('age-confirm-btn');
    ageDenyBtn = document.getElementById('age-deny-btn');

    // Gender Modal
    genderModal = document.getElementById('gender-modal');
    selectGenderMale = document.getElementById('select-gender-male');
    selectGenderFemale = document.getElementById('select-gender-female');

    // Shop Modal
    shopModal = document.getElementById('shop-modal');
    closeShopBtn = document.getElementById('close-shop-btn');
    watchAdBtn = document.getElementById('watch-ad-btn');
    exchangeCoinsBtn = document.getElementById('exchange-coins-btn');

    // Limit Modal
    limitModal = document.getElementById('limit-modal');
    openShopLimitBtn = document.getElementById('open-shop-limit-btn');

    // Ad Modal
    adModal = document.getElementById('ad-modal');
    closeAdBtn = document.getElementById('close-ad-btn');
    adTimerDisplay = document.getElementById('ad-timer');

    // Economy Display
    coinBalanceDisplay = document.getElementById('coin-balance-display');
    // Removed unused upgradeVipBtn here

    const submitDemographicsBtn = document.getElementById('submit-demographics');
    if (submitDemographicsBtn) submitDemographicsBtn.addEventListener('click', submitDemographics);

    // Check Age Verification
    checkAgeVerification();

    // 2. Attach Event Listeners
    if (startStopBtn) startStopBtn.addEventListener('click', toggleSearch);

    if (nextBtn) nextBtn.addEventListener('click', nextChat);

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (cameraBtn) cameraBtn.addEventListener('click', toggleCamera);

    if (interestsBtn) {
        interestsBtn.addEventListener('click', () => {
            // For now, open settings as interests are inside settings/main view inputs?
            // Actually, the interest-input is in the sidebar which is hidden.
            // We need to show a modal for interests or toggle a visible container.
            // Let's reuse 'settings-modal' for now or 'shop-modal' if desired, but user likely wants 'Interests'.
            // I'll assume there isn't a dedicated modal yet, so I will trigger a prompt or focus the existing input if visible.
            // Use focus if visible, otherwise alert or open settings.
            const sidebarHidden = document.getElementById('sidebar-hidden');
            // Current UI has NO visible interest input in main view.
            // I will open a "Interests" modal. For now, I'll alert or reuse settings if mapped.
            // Better: Reuse Settings Modal and focus interest input there if moved?
            // Actually, let's just log for now or open Settings.
            if (settingsModal) openModal(settingsModal);
        });
    }

    // Mobile Media Controls might need separate listeners if IDs are unique, but we reused IDs?
    // Wait, I used duplicate IDs in the HTML for mute-btn/camera-btn if I'm not careful.
    // In the HTML reform, I removed the overlay controls from user video wrapper on mobile?
    // Let's check IDs. I see 'mute-btn' and 'camera-btn' in "Mobile Vertical Controls".
    // I need to ensure there are no duplicate IDs or querySelectorAll is used.
    // I likely used same IDs. I need to fix this.
    // I will use classes for media buttons.

    document.querySelectorAll('.media-btn, #mute-btn, #camera-btn').forEach(btn => {
        if (btn.id === 'mute-btn') btn.addEventListener('click', toggleMute);
        if (btn.id === 'camera-btn') btn.addEventListener('click', toggleCamera);
    });
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));

    // Profile Dropdown Logic
    userProfileBtn = document.getElementById('user-profile');
    userProfileDropdown = document.getElementById('user-profile-dropdown');

    if (userProfileBtn && userProfileDropdown) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Guest Check
            if (userData && userData.email && userData.email.includes('guest')) {
                if (loginModal) openModal(loginModal);
                return;
            }
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

    // Block User Logic - Moved from startSearch
    if (blockUserAction) {
        blockUserAction.addEventListener('click', () => {
            if (currentPartnerId) {
                let blockedUserIds = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
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

    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => closeModal(reportModal));
    if (submitReportBtn) submitReportBtn.addEventListener('click', submitReport);

    // Age Verification Listeners
    if (ageConfirmBtn) ageConfirmBtn.addEventListener('click', confirmAge);
    if (ageDenyBtn) ageDenyBtn.addEventListener('click', denyAge);

    // Gender Selection
    // REMOVED individual selection listeners because they just toggle UI state now, handled by onclick or window.selectGender
    // if (selectGenderMale) selectGenderMale.addEventListener('click', () => setGender('male'));
    // if (selectGenderFemale) selectGenderFemale.addEventListener('click', () => setGender('female'));

    // Shop Listeners
    if (closeShopBtn) closeShopBtn.addEventListener('click', () => closeModal(shopModal));
    if (watchAdBtn) watchAdBtn.addEventListener('click', watchAd);
    if (exchangeCoinsBtn) exchangeCoinsBtn.addEventListener('click', exchangeCoins);
    // buyDiamondsBtn removed/mock replaced

    // Header Economy Click
    // Header Economy Click
    const coinDisplayEl = document.getElementById('coin-display');
    if (coinDisplayEl) coinDisplayEl.addEventListener('click', () => openModal(shopModal));

    const upgradeVipBtnEl = document.getElementById('upgrade-vip-btn');
    if (upgradeVipBtnEl) {
        console.log("Found upgrade VIP button, adding listener");
        upgradeVipBtnEl.addEventListener('click', () => {
            console.log("Upgrade VIP Clicked");
            openModal(shopModal);
        });
    } else {
        console.error("Upgrade VIP button NOT FOUND");
    }

    // Limit Modal
    if (openShopLimitBtn) openShopLimitBtn.addEventListener('click', () => {
        closeModal(limitModal);
        openModal(shopModal);
    });

    // --- Theme Logic ---
    // Dark mode is now permanently enforced via CSS/HTML classes.
    // Legacy toggle logic has been removed.

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
            // Connect automatically to the server serving this page
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
                if (onlineCountNum) {
                    const parent = onlineCountNum.parentElement;
                    parent.classList.add('bg-green-500/20', 'text-green-400', 'border-green-500/50');
                    parent.classList.remove('text-gray-400', 'bg-white/5');
                }
            });

            socket.on('disconnect', () => {
                console.log("Socket disconnected!");
                if (onlineCountNum) {
                    const parent = onlineCountNum.parentElement;
                    parent.classList.remove('bg-green-500/20', 'text-green-400', 'border-green-500/50');
                    parent.classList.add('text-gray-400', 'bg-white/5');
                }
                addSystemMessage("Lost connection to server.");
            });

            socket.on('user_count', (count) => {
                if (onlineCountNum) onlineCountNum.textContent = count.toLocaleString();
            });

            socket.on('connect_error', (err) => {
                console.error("Socket Connection Error:", err);
            });

            socket.on('partner_found', async ({ initiator, commonInterests, partnerId, partnerCountry, partnerFlag, partnerGender }) => {
                isInitiator = initiator;
                isConnected = true;
                currentPartnerId = partnerId; // Store partner ID for blocking
                setUIState('connected');

                // Update UI with partner country
                const strangerCountryEl = document.getElementById('stranger-country');
                const strangerFlagEl = document.getElementById('stranger-flag');

                if (strangerCountryEl) strangerCountryEl.textContent = partnerCountry || 'Global';
                if (strangerFlagEl) strangerFlagEl.textContent = partnerFlag || '🌐';
                // Gender display could be added here if there's a UI element for it in the future
                console.log(`Matched with: ${partnerCountry} (${partnerFlag}), Gender: ${partnerGender}`);

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

    if (!userData) {
        userData = {
            email: "guest@example.com",
            displayName: "Guest",
            uid: "guest_" + Math.random().toString(36).substr(2, 9),
            photoURL: null
        };
    }

    // Razorpay Logic (Handles both Coins and VIP Plans)
    window.buyCoins = async function (itemId) {
        if (!itemId) return;

        const isPlan = itemId.startsWith('vip_');
        const itemType = isPlan ? "VIP Plan" : "Coin Package";

        try {
            addSystemMessage("Initiating payment for " + itemType + "...");

            // 1. Create Order
            const currency = (userData && userData.countryCode === 'IN') ? 'INR' : 'USD';
            const payload = isPlan ? { planId: itemId, currency } : { packageId: itemId, currency: 'USD' };

            const orderRes = await fetch('/api/payment/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const order = await orderRes.json();

            if (order.error) throw new Error(order.error);

            // 2. Open Razorpay
            const options = {
                "key": "rzp_test_placeholder", // Replace with public key if needed
                "amount": order.amount,
                "currency": order.currency,
                "name": "Ome Video Chat",
                "description": isPlan ? "VIP Membership" : "Purchase Coins",
                "image": "https://skipsee.com/logo.png",
                "order_id": order.id,
                "handler": async function (response) {
                    // 3. Verify Payment
                    addSystemMessage("Payment authorized. Verifying...");

                    try {
                        const verifyPayload = {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        };

                        if (isPlan) verifyPayload.planId = itemId;
                        else verifyPayload.packageId = itemId;

                        const verifyRes = await fetch('/api/payment/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(verifyPayload)
                        });
                        const verifyData = await verifyRes.json();

                        if (verifyData.success) {
                            if (verifyData.isVip) {
                                addSystemMessage(`Success! You make your move to VIP.`);
                                alert(`Success! You make your move to VIP.`);
                            } else {
                                addSystemMessage(`Success! Added ${verifyData.newCoins} Coins.`);
                            }

                            // Refresh User Data to update UI
                            init(); // Re-fetch user
                            // Close Shop
                            if (shopModal) shopModal.classList.add('hidden');
                        } else {
                            throw new Error(verifyData.error || "Verification failed");
                        }
                    } catch (verifyErr) {
                        console.error(verifyErr);
                        alert("Verification Error: " + verifyErr.message);
                    }
                },
                "prefill": {
                    "name": userData.displayName,
                    "email": userData.email,
                },
                "theme": {
                    "color": "#eab308"
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.desc);
                console.error(response.error);
            });
            rzp1.open();

        } catch (e) {
            console.error(e);
            alert("Payment Error: " + e.message);
        }
    }
    // 4. Media Setup
    await setupMedia();

    // 5. Fetch Location logic
    // 5. Fetch Location logic with Fallback
    try {
        let countryName = 'Unknown';
        let countryCode = null;

        try {
            const geoExp = await fetch('https://ipapi.co/json/');
            if (geoExp.ok) {
                const geoData = await geoExp.json();
                countryName = geoData.country_name;
                countryCode = geoData.country_code;
            } else {
                throw new Error("Primary API failed");
            }
        } catch (e) {
            console.warn("Primary IP API failed, trying fallback...", e);
            try {
                // Fallback: api.country.is (Simple, HTTPS supported)
                const fallback = await fetch('https://api.country.is');
                if (fallback.ok) {
                    const data = await fallback.json();
                    countryCode = data.country;
                    // Map code to name if possible, or just use code
                    countryName = data.country;
                }
            } catch (err2) {
                console.warn("Fallback IP API failed:", err2);
            }
        }

        if (userData && countryCode) {
            userData.country = countryName;
            userData.countryCode = countryCode;
            userData.flag = getFlagEmoji(countryCode);

            // Update local UI
            const localFlagEl = document.getElementById('local-flag');
            if (localFlagEl) localFlagEl.textContent = userData.flag;
        }

        // Update Shop Prices based on country
        updateShopPrices(userData ? userData.countryCode : null);

    } catch (e) {
        console.warn("Location fetch logic error:", e);
    }

    if (socket) {
        // Listen for online count updates
        socket.on('user_count', (count) => {
            if (onlineCountNum) onlineCountNum.textContent = count;
        });

        if (socket.connected) {
            socket.emit('join_user', userData);
        } else {
            socket.on('connect', () => {
                socket.emit('join_user', userData);
                console.log("Socket connected!");
            });
        }
    }

    // Update UI & Check Age
    updateProfileUI();
    if (coinBalanceDisplay) coinBalanceDisplay.innerText = userData.coins || 0;
    checkAgeVerification();

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

function updateShopPrices(countryCode) {
    const isIndia = countryCode === 'IN';

    // VIP Price Mapping
    const prices = {
        'price-vip-2-weeks': isIndia ? '₹199' : '$2.99',
        'price-vip-1-month': isIndia ? '₹1,200' : '$14.99',
        'price-vip-5-months': isIndia ? '₹2,000' : '$29.99',
        'price-vip-7-months': isIndia ? '₹5,500' : '$69.99',
        'price-vip-1-year': isIndia ? '₹9,000' : '$99.99'
    };

    for (const [id, price] of Object.entries(prices)) {
        const el = document.getElementById(id);
        if (el) el.textContent = price;
    }
}

// --- Media Functions ---

async function setupMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // Store original track for constraints (Noise/Echo)
        originalAudioTrack = localStream.getAudioTracks()[0];

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
            const processedAudioTrack = destination.stream.getAudioTracks()[0];

            localStream.removeTrack(originalAudioTrack);
            localStream.addTrack(processedAudioTrack);

        } catch (err) {
            console.error("Web Audio API not supported or failed:", err);
        }

        if (localVideo) {
            localVideo.srcObject = localStream;
            // Mute local video element to prevent feedback
            localVideo.muted = true;
        }

        // Apply initial constraints if toggle is checked
        applyAudioConstraints();

    } catch (err) {
        console.error("Media Setup CRITICAL FAILURE:", err);
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);

        let msg = "Error accessing camera/microphone: " + err.message;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = "Please allow camera and microphone access to use this app.";
        } else if (err.name === 'NotFoundError') {
            msg = "No camera or microphone found.";
        } else if (err.name === 'NotReadableError') {
            msg = "Camera/Mic is being used by another application (Zoom, Teams, etc). Please close it and reload.";
        }

        addSystemMessage(msg);
        alert(msg); // Force alert so user sees it
    }
}

function setAudioGain(value) {
    if (gainNode) {
        gainNode.gain.value = value;
    }
}

async function applyAudioConstraints() {
    // Apply constraints to the ORIGINAL source track, not the processed WebAudio track
    if (!originalAudioTrack) return;

    const constraints = {
        noiseSuppression: noiseReductionToggle ? noiseReductionToggle.checked : false,
        echoCancellation: true, // Always on for chat
        autoGainControl: false // We handle gain manually
    };

    try {
        await originalAudioTrack.applyConstraints(constraints);
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
        tagEl.className = 'flex items-center gap-1.5 px-3 py-1 bg-brand-500/20 border border-brand-500/30 text-brand-200 text-xs font-bold rounded-lg uppercase tracking-wide';
        tagEl.innerHTML = `
            ${tag} 
            <span class="cursor-pointer text-brand-400 hover:text-white transition-colors" onclick="removeInterest('${tag}')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </span>`;
        interestsContainer.appendChild(tagEl);
    });

    interestsContainer.appendChild(input);
    input.focus();
}

// Make removeInterest global so onclick works
window.removeInterest = removeInterest;

function toggleSearch() {
    if (!startStopBtn) return;

    // Guest Check
    if (userData && userData.email && userData.email.includes('guest')) {
        if (loginModal) openModal(loginModal);
        return;
    }

    // Check innerText to handle nested spans
    const text = startStopBtn.innerText.trim().toUpperCase();
    if (text.includes('START')) {
        startSearch();
    } else {
        stopChat();
    }
}

function startSearch() {
    if (isConnected) return;
    setUIState('searching');

    // Nuclear Option: Force hide PIP repeatedly to fight any async unhiding
    if (pipContainer) {
        pipContainer.classList.add('hidden');
        pipContainer.style.setProperty('display', 'none', 'important');

        let attempts = 0;
        const forceHideInterval = setInterval(() => {
            pipContainer.style.setProperty('display', 'none', 'important');
            pipContainer.classList.add('hidden');
            attempts++;
            if (attempts > 10) clearInterval(forceHideInterval);
        }, 100);
    }
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

    // Block User Logic handled in init() now
    let blockedUserIds = JSON.parse(localStorage.getItem('blockedUsers') || '[]');

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
            remoteVideo.play().catch(e => console.error("Error auto-playing remote video:", e));
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
    // Centered Pill Style for System Messages (Overlay friendly)
    div.className = "text-center my-3";
    div.innerHTML = `<span class="inline-block px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-brand-400 tracking-wide shadow-sm">${text}</span>`;
    chatLog.appendChild(div);
    scrollToBottom();
}

function addMessage(sender, text) {
    if (!chatLog) return;
    const div = document.createElement('div');
    const isMe = sender === 'You';

    // Base classes
    let classes = "w-fit max-w-[85%] p-3.5 rounded-2xl mb-3 text-sm shadow-md backdrop-blur-md break-words leading-relaxed animate-fade-in-up";

    if (isMe) {
        // Me: Vivid Orange Gradient
        classes += " ms-auto bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-br-none border border-white/10";
    } else {
        // Stranger: Dark Glass for readability over video
        classes += " me-auto bg-black/60 text-white border border-white/10 rounded-bl-none hover:bg-black/70 transition-colors";
    }

    div.className = classes;
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

    // Elements likely cached or re-fetched if we want to be safe, but we can assume globals/IDs
    const pipContainer = document.getElementById('pip-container');
    const homeGrid = document.getElementById('home-grid-overlay');
    const videoPlaceholder = document.getElementsByClassName('video-placeholder')[0];
    const strangerTitle = document.querySelector('#stranger-video-wrapper h2');
    const strangerSub = document.querySelector('#stranger-video-wrapper p');


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
        // IDLE STATE: Show Grid, Hide PIP, Video Placeholder Text = "Start Chat"
        if (homeGrid) {
            homeGrid.classList.remove('opacity-0', 'pointer-events-none');
            homeGrid.classList.add('opacity-100', 'z-20');
        }
        if (pipContainer) {
            pipContainer.classList.add('hidden');
            pipContainer.style.display = 'none';
            pipContainer.style.setProperty('display', 'none', 'important');
        }
        if (remotePlaceholder) remotePlaceholder.style.display = 'none'; // Hide radar in idle, show grid instead

        // Start Button
        startStopBtn.innerHTML = '<span class="group-hover:translate-x-[-2px] transition-transform">Start</span><svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>';

        startStopBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        startStopBtn.classList.add('bg-gradient-to-r', 'from-violet-600', 'to-indigo-600', 'hover:from-violet-500', 'hover:to-indigo-500', 'shadow-[0_0_15px_rgba(139,92,246,0.4)]');
        setBtn(startStopBtn, true);

        // Hide Skip Button
        setBtn(nextBtn, false);
        nextBtn.classList.add('hidden');
        nextBtn.classList.remove('flex');

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type a message...';
        }
        if (sendBtn) sendBtn.disabled = true;

        if (interestInput) interestInput.disabled = false;

    } else if (state === 'searching') {
        // SEARCHING STATE: Hide Grid, Hide PIP (Wait for connection), Show Radar
        if (homeGrid) {
            homeGrid.classList.remove('opacity-100', 'z-20');
            homeGrid.classList.add('opacity-0', 'pointer-events-none');
        }
        if (pipContainer) {
            pipContainer.classList.add('hidden'); // HIDDEN until connected
            pipContainer.style.display = 'none'; // Force hide
            pipContainer.style.setProperty('display', 'none', 'important'); // NUCLEAR OPTION
        }
        if (remotePlaceholder) remotePlaceholder.style.display = 'flex';
        if (remoteVideo) remoteVideo.srcObject = null;

        // Stop Button
        startStopBtn.innerHTML = '<span>Stop</span>';
        startStopBtn.classList.remove('bg-gradient-to-r', 'from-violet-600', 'to-indigo-600', 'hover:from-violet-500', 'hover:to-indigo-500', 'shadow-[0_0_15px_rgba(139,92,246,0.4)]');
        startStopBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        setBtn(startStopBtn, true);

        // Show Skip Button
        setBtn(nextBtn, true);
        nextBtn.classList.remove('hidden');
        nextBtn.classList.add('flex');

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Waiting for a stranger...';
        }
        if (sendBtn) sendBtn.disabled = true;

        // Allow editing interests while searching
        if (interestInput) interestInput.disabled = false;

    } else if (state === 'connected') {
        // CONNECTED STATE: Hide Grid, Show PIP, Show Video
        if (homeGrid) {
            homeGrid.classList.remove('opacity-100', 'z-20');
            homeGrid.classList.add('opacity-0', 'pointer-events-none');
        }
        if (pipContainer) {
            // Force SHOW
            pipContainer.classList.remove('hidden');
            pipContainer.style.removeProperty('display');
            pipContainer.style.display = 'block';
        }
        if (pipContainer) {
            pipContainer.classList.remove('hidden');
            pipContainer.style.display = 'block';
            pipContainer.style.removeProperty('display'); // Remove !important override
        }
        if (remotePlaceholder) remotePlaceholder.style.display = 'none';

        // Stop Button
        startStopBtn.innerHTML = '<span>Stop</span>';
        startStopBtn.classList.remove('bg-gradient-to-r', 'from-violet-600', 'to-indigo-600', 'hover:from-violet-500', 'hover:to-indigo-500', 'shadow-[0_0_15px_rgba(139,92,246,0.4)]');
        startStopBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'shadow-none');
        setBtn(startStopBtn, true);

        // Show Skip Button
        setBtn(nextBtn, true);
        nextBtn.classList.remove('hidden');
        nextBtn.classList.add('flex');

        if (sendBtn) sendBtn.disabled = false;

        if (interestInput) interestInput.disabled = false;
    }

    // --- Mobile Buttons Logic ---
    const mobileStartBtn = document.getElementById('mobile-start-btn');
    const mobileNextBtn = document.getElementById('mobile-next-btn');

    if (mobileStartBtn) {
        if (state === 'searching' || state === 'connected') {
            mobileStartBtn.innerText = "Stop";
            mobileStartBtn.classList.replace('bg-white/20', 'bg-red-500/80');

            if (mobileNextBtn) {
                mobileNextBtn.classList.remove('hidden');
                mobileNextBtn.classList.add('flex');
            }
        } else {
            mobileStartBtn.innerText = "Start";
            mobileStartBtn.classList.replace('bg-red-500/80', 'bg-white/20');

            if (mobileNextBtn) {
                mobileNextBtn.classList.add('hidden');
                mobileNextBtn.classList.remove('flex');
            }
        }
    }
}

// --- Profile & Modal Functions ---

function updateProfileUI() {
    const vipBadgeHeader = document.getElementById('vip-badge-header');
    const vipBadgeSidebar = document.getElementById('vip-badge-sidebar');

    if (userNameEl && userData) userNameEl.textContent = userData.displayName;
    if (userAvatarEl && userData && userData.photoURL) userAvatarEl.src = userData.photoURL;

    // VIP Badge Logic
    const isVip = userData && userData.isVip;

    if (vipBadgeHeader) {
        if (isVip) vipBadgeHeader.classList.remove('hidden');
        else vipBadgeHeader.classList.add('hidden');
    }
    if (vipBadgeSidebar) {
        if (isVip) vipBadgeSidebar.classList.remove('hidden');
        else vipBadgeSidebar.classList.add('hidden');
    }
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

async function saveProfile() {
    if (editNameInput && userData) {
        const newName = editNameInput.value.trim();
        if (newName) {
            try {
                const res = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: newName })
                });
                const data = await res.json();

                if (data.success) {
                    userData.displayName = data.displayName;
                    updateProfileUI();
                    addSystemMessage("Profile updated successfully!");
                    closeModal(settingsModal);
                } else {
                    alert("Error: " + (data.error || "Failed to update profile"));
                }
            } catch (error) {
                console.error("Profile save error:", error);
                alert("Failed to save profile. Check connection.");
            }
        }
    }
}

async function submitReport() {
    if (reportReasonInput) {
        const reason = reportReasonInput.value.trim();
        if (reason) {
            const targetId = currentPartnerId || 'unknown';
            try {
                const res = await fetch('/api/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: reason, targetUserId: targetId })
                });

                if (res.ok) {
                    alert("Report submitted successfully.");
                    reportReasonInput.value = '';
                    closeModal(reportModal);
                } else {
                    alert("Failed to submit report. Please try again.");
                }
            } catch (error) {
                console.error("Report error:", error);
                alert("Error submitting report.");
            }
        }
    }
}

// --- Age Verification Functions ---

function checkAgeVerification() {
    if (userData && !userData.ageVerified) {
        if (ageVerificationModal) {
            ageVerificationModal.classList.remove('hidden');
        }
    } else {
        // If age is already verified (e.g. session persisted), check demographics
        checkDemographics();
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
            // Chain: Show Demographics Modal
            checkDemographics();
        } else {
            console.error("Failed to verify age with backend");
        }
    } catch (e) {
        console.error("Error verifying age:", e);
    }
}
window.confirmAge = confirmAge;

function denyAge() {
    window.location.href = 'https://www.google.com';
}

// --- Demographics Functions ---

function checkDemographics() {
    // Check if user needs to set gender/dob
    // We can check if userData.gender or userData.dob is missing
    // Note: server returns userData.gender. We added dob to user response? 
    // We should assume if gender is missing, we ask.

    if (userData && (!userData.gender || !userData.dob)) {
        if (genderModal) {
            genderModal.classList.remove('hidden');
        }
    }
}

window.selectGender = function (gender) {
    const maleBtn = document.getElementById('select-gender-male');
    const femaleBtn = document.getElementById('select-gender-female');
    const hiddenInput = document.getElementById('selected-gender');

    if (!maleBtn || !femaleBtn || !hiddenInput) return;

    // Reset styles
    maleBtn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-500/20', 'border-blue-500');
    femaleBtn.classList.remove('ring-2', 'ring-pink-500', 'bg-pink-500/20', 'border-pink-500');

    // Also remove the light mode classes if they persisted in DOM slightly (safety)
    maleBtn.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
    femaleBtn.classList.remove('bg-pink-50', 'dark:bg-pink-900/20');

    hiddenInput.value = gender;

    if (gender === 'male') {
        maleBtn.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/20', 'border-blue-500');
    } else {
        femaleBtn.classList.add('ring-2', 'ring-pink-500', 'bg-pink-500/20', 'border-pink-500');
    }
}

async function submitDemographics() {
    const dobInput = document.getElementById('dob-input');
    const genderInput = document.getElementById('selected-gender');

    if (!dobInput || !genderInput) return;

    const dob = dobInput.value;
    const gender = genderInput.value;

    if (!dob) {
        alert("Please enter your Date of Birth.");
        return;
    }
    if (!gender) {
        alert("Please select your gender.");
        return;
    }

    // Basic Age Check (already did 18+, but could validate DOB here too)
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 18) {
        alert("You must be 18+ to use this app.");
        return;
    }

    try {
        const res = await fetch('/api/user/demographics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender, dob })
        });

        const data = await res.json();

        if (data.success) {
            if (userData) {
                userData.gender = gender;
                userData.dob = dob;
                // Update specific UI if needed (e.g. profile icons)
            }
            if (genderModal) genderModal.classList.add('hidden');
            addSystemMessage("Profile updated successfully!");
        } else {
            alert("Error: " + (data.error || "Failed to update profile"));
        }
    } catch (e) {
        console.error("Error submitting demographics:", e);
        alert("Connection error. Please try again.");
    }
}

// Attach listener later or make global?
// The submit button exists in HTML. I need to add listener in init() or bind it here?
// I will bind it in init(). STARTUP LOGIC in init() needs to be updated to find the new button.

// --- Ad Logic ---
let adTimerInterval;

function showAd(callback) {
    if (userData && userData.isVip) {
        if (callback) callback();
        return;
    }

    const modal = document.getElementById('ad-modal');
    const timerDisplay = document.getElementById('ad-timer');
    const closeBtn = document.getElementById('close-ad-btn');

    if (!modal) {
        if (callback) callback();
        return;
    }

    modal.classList.remove('hidden');
    let timeLeft = 5;

    if (timerDisplay) timerDisplay.textContent = timeLeft;
    if (closeBtn) {
        closeBtn.disabled = true;
        closeBtn.textContent = `Skip in ${timeLeft}s`;
        closeBtn.onclick = null; // Clear previous listeners
    }

    if (adTimerInterval) clearInterval(adTimerInterval);

    adTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.textContent = timeLeft;
        if (closeBtn) closeBtn.textContent = `Skip in ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(adTimerInterval);
            if (closeBtn) {
                closeBtn.disabled = false;
                closeBtn.textContent = "Skip Ad";
                closeBtn.onclick = () => {
                    closeAd(callback);
                };
            }
        }
    }, 1000);
}

function closeAd(callback) {
    const modal = document.getElementById('ad-modal');
    if (modal) modal.classList.add('hidden');
    if (callback && typeof callback === 'function') callback();
}

// Global functions for HTML onclick
window.closeAd = closeAd;
window.submitDemographics = submitDemographics;
window.selectGender = selectGender;
window.confirmAge = confirmAge;
window.denyAge = denyAge;

// --- PIP Draggable Logic ---
function initPIPDraggable() {
    const pip = document.getElementById('pip-container');
    if (!pip) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    function dragStart(e) {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        // Only drag if clicking the container or video, NOT buttons
        if (e.target.closest('button')) return;

        if (e.target.closest('#pip-container')) {
            isDragging = true;
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, pip);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }

    pip.addEventListener("touchstart", dragStart, { passive: false });
    pip.addEventListener("touchend", dragEnd, false);
    pip.addEventListener("touchmove", drag, { passive: false });

    pip.addEventListener("mousedown", dragStart, false);
    pip.addEventListener("mouseup", dragEnd, false);
    pip.addEventListener("mousemove", drag, false);
    pip.addEventListener("mouseleave", dragEnd, false);
}

// Init PIP on load
initPIPDraggable();

