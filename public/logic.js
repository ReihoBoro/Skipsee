
// --- Economy & Gender Logic ---

async function checkGender() {
    if (!userData) return;
    // Server should send gender in api/user, but if not we can check or it might be null
    // If null, show modal
    if (!userData.gender) {
        openModal(genderModal);
    }
}

async function setGender(gender) {
    try {
        const res = await fetch('/api/user/gender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender })
        });
        const data = await res.json();
        if (data.success) {
            userData.gender = gender;
            closeModal(genderModal);
            addSystemMessage(`Gender set to ${gender}.`);
        } else {
            console.error(data.error);
        }
    } catch (e) { console.error(e); }
}

async function updateEconomyUI() {
    if (!diamondDisplay || !coinDisplay || !userData) return;
    diamondDisplay.textContent = userData.diamonds || 0;
    coinDisplay.textContent = userData.coins || 0;
}

// Override updateProfileUI to include economy
const originalUpdateProfileUI = window.updateProfileUI || function () { };
window.updateProfileUI = function () {
    if (typeof originalUpdateProfileUI === 'function') originalUpdateProfileUI(); // Call original if exists (it's internal to init but we might need to expose it or just copy logic)

    // Actually, since updateProfileUI is inside init scope in previous code, I might not be able to override it easily unless I move it out. 
    // I'll just rely on my own function called from fetch

    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    if (userNameEl) userNameEl.textContent = userData.displayName;
    if (userAvatarEl && userData.photoURL) userAvatarEl.src = userData.photoURL;

    updateEconomyUI();
    checkGender();
};

async function watchAd() {
    // Simulating Ad Watch
    const btn = document.getElementById('watch-ad-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Watching... (5s)";

    setTimeout(async () => {
        try {
            const res = await fetch('/api/economy/ad-click', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                userData.diamonds = data.newBalance;
                updateEconomyUI();
                addSystemMessage("You earned 1 Diamond! 💎");
            }
        } catch (e) { console.error(e); }
        btn.textContent = originalText;
        btn.disabled = false;
    }, 5000);
}

async function exchangeCoins() {
    try {
        const res = await fetch('/api/economy/exchange', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            userData.diamonds = data.newDiamonds;
            userData.coins = data.newCoins;
            updateEconomyUI();
            addSystemMessage("Exchanged 150 Coins for 20 Diamonds! 💎");
        } else {
            alert(data.error || "Exchange failed");
        }
    } catch (e) { console.error(e); }
}

async function buyDiamondsMock() {
    // Simulate Stripe
    const btn = document.getElementById('buy-diamonds-btn');
    btn.disabled = true;
    btn.textContent = "Processing...";

    setTimeout(async () => {
        try {
            const res = await fetch('/api/payment/confirm-mock', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // Refresh user data
                const userRes = await fetch('/api/user');
                const userDataRes = await userRes.json();
                if (userDataRes.authenticated) {
                    userData.diamonds = userDataRes.user.diamonds;
                    updateEconomyUI();
                    addSystemMessage("Purchase successful! +100 Diamonds 💎");
                    closeModal(shopModal);
                }
            }
        } catch (e) { console.error(e); }
        btn.disabled = false;
        btn.textContent = "Buy Now";
    }, 2000);
}

// Helper for Modals (if not already global)
function openModal(modal) {
    if (modal) modal.classList.remove('hidden');
}
function closeModal(modal) {
    if (modal) modal.classList.add('hidden');
}

// Socket Listen for Limit
if (typeof socket !== 'undefined') {
    socket.on('error_limit_reached', () => {
        openModal(limitModal);
        addSystemMessage("Daily match limit reached.");
    });
}
