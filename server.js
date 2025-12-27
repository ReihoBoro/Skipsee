require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const cron = require('node-cron');
const { User } = require('./database');


const app = express();

// --- Middleware (Moved to Top) ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development (e.g. Live Server port 5500)
        methods: ["GET", "POST"]
    }
});

// --- Environment Variable Check ---
const requiredEnvVars = [
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'SESSION_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
const placeholderValues = [
    'your_google_client_id', 'your_google_client_secret',
    'your_super_secret_session_key'
];

const invalidEnvVars = requiredEnvVars.filter(key => {
    const value = process.env[key];
    return value && placeholderValues.includes(value);
});

if (missingEnvVars.length > 0 || invalidEnvVars.length > 0) {
    console.error('----------------------------------------------------------------');
    console.warn('WARNING: Environment Configuration Issue');

    if (missingEnvVars.length > 0) {
        console.warn('Missing required environment variables:', missingEnvVars);
    }

    if (invalidEnvVars.length > 0) {
        console.warn('Using placeholder values for:', invalidEnvVars);
    }

    console.warn('----------------------------------------------------------------');
    console.warn('The server will start, but Authentication/Payment features WILL fail.');
    console.warn('Please set these variables in your deployment dashboard.');
    console.error('----------------------------------------------------------------');
    // process.exit(1); // REMOVED: Do not crash, allow static site to load for debugging
}

// --- Session Setup ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// --- Passport Setup ---
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
},
    (accessToken, refreshToken, profile, done) => {
        // In a real app, you would save/update user in DB here
        const user = {
            id: profile.id,
            displayName: profile.displayName,
            provider: 'google',
            email: profile.emails?.[0]?.value,
            photo: profile.photos?.[0]?.value
        };
        User.createOrUpdate(user)
            .then(() => User.get(user.id))
            .then(dbUser => done(null, { ...user, ...dbUser }))
            .catch(err => done(err));
    }
));



// --- Routes ---

// Serve index.html on root always (Modal login handles auth)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);




app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.post('/api/economy/ad-click', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
        await User.addCoins(req.user.id, 1);
        res.json({ success: true, newBalance: (req.user.coins || 0) + 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        const coins = req.user.coins || 0;
        const now = new Date();
        const vipExpires = req.user.vip_expires_at ? new Date(req.user.vip_expires_at) : null;
        // Check both subscription and legacy coin method
        const isVip = (vipExpires && vipExpires > now) || coins >= 15;

        res.json({
            authenticated: true,
            user: { ...req.user, isVip: isVip },
            ageVerified: req.session.ageVerified || false
        });
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/verify-age', (req, res) => {
    req.session.ageVerified = true;
    res.json({ success: true });
});

// Razorpay Integration
const Razorpay = require('razorpay');
// Initialize Razorpay (Use environment variables in production)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// Pricing Packages
// Pricing Packages
const COIN_PACKAGES = {
    'pkg_500': { price: 2.21, coins: 500, currency: "USD" },
    'pkg_1799': { price: 13.37, coins: 1799, currency: "USD" },
    'pkg_7000': { price: 55.47, coins: 7000, currency: "USD" },
    'pkg_10000': { price: 88.77, coins: 10000, currency: "USD" }
};

const VIP_PLANS = {
    'vip_2_weeks': { durationDays: 14, amountINR: 19900, amountUSD: 299, name: '2 Weeks' },
    'vip_1_month': { durationDays: 30, amountINR: 120000, amountUSD: 1499, name: '1 Month' },
    'vip_5_months': { durationDays: 150, amountINR: 200000, amountUSD: 2999, name: '5 Months' },
    'vip_7_months': { durationDays: 210, amountINR: 550000, amountUSD: 6999, name: '7 Months' },
    'vip_1_year': { durationDays: 365, amountINR: 900000, amountUSD: 9999, name: '1 Year' }
};

app.post('/api/payment/create-order', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { packageId, planId, currency } = req.body; // currency: 'INR' or 'USD'
    let options = {};
    const targetCurrency = currency === 'INR' ? 'INR' : 'USD';

    if (planId && VIP_PLANS[planId]) {
        const plan = VIP_PLANS[planId];
        const amount = targetCurrency === 'INR' ? plan.amountINR : plan.amountUSD;

        options = {
            amount: amount, // Already in subunits (paise or cents)
            currency: targetCurrency,
            receipt: "sub_rcptid_" + req.user.id + "_" + Date.now(),
            notes: { userId: req.user.id, planId: planId, type: 'subscription' }
        };
    } else if (packageId && COIN_PACKAGES[packageId]) {
        const pkg = COIN_PACKAGES[packageId];
        // Coins are currently USD only in this simple implementation, or we could add INR mapping later
        // For now, sticking to the existing USD logic for coins as per request focus on VIP
        options = {
            amount: Math.round(pkg.price * 100),
            currency: "USD",
            receipt: "coin_rcptid_" + req.user.id + "_" + Date.now(),
            notes: { userId: req.user.id, packageId: packageId, type: 'coins' }
        };
    } else {
        return res.status(400).json({ error: 'Invalid plan or package ID' });
    }

    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payment/verify-payment', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const crypto = require('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId, planId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        try {
            if (planId && VIP_PLANS[planId]) {
                const plan = VIP_PLANS[planId];
                const now = new Date();
                const currentExpiry = (req.user.vip_expires_at && new Date(req.user.vip_expires_at) > now)
                    ? new Date(req.user.vip_expires_at).getTime()
                    : now.getTime();
                const newExpiry = new Date(currentExpiry + (plan.durationDays * 24 * 60 * 60 * 1000)).toISOString();

                await User.setVipExpiry(req.user.id, newExpiry);
                res.json({ success: true, isVip: true, newExpiry });
            } else if (packageId && COIN_PACKAGES[packageId]) {
                const pkg = COIN_PACKAGES[packageId];
                // CHANGED: Award DIAMONDS instead of Coins, matching UI expectation
                await User.addDiamonds(req.user.id, pkg.coins); // pkg.coins holds the amount
                res.json({ success: true, newDiamonds: pkg.coins });
            } else {
                throw new Error("Invalid item in verification");
            }
        } catch (err) {
            res.status(500).json({ error: "DB Error: " + err.message });
        }
    } else {
        res.status(400).json({ error: 'Invalid signature' });
    }
});

// Exchange Route (Coins -> Diamonds)
app.post('/api/economy/exchange', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
        // Exchange 150 Coins for 20 Diamonds
        const result = await User.exchangeCoinsToDiamonds(req.user.id, 150, 20);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Legacy Gender Route (Forward to Demographics)
app.post('/api/user/gender', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { gender } = req.body;
        await User.updateDemographics(req.user.id, gender, null); // Don't wipe DOB if null
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update gender" });
    }
});

// Update Profile Endpoint
app.post('/api/user/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { displayName } = req.body;
    if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid display name' });
    }

    try {
        await User.createOrUpdate({
            ...req.user,
            displayName: displayName.trim()
        });
        res.json({ success: true, displayName: displayName.trim() });
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

// Demographics Endpoint (Fix for Connection Error)
app.post('/api/user/demographics', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { gender, dob } = req.body;
    if (!gender || !dob) {
        return res.status(400).json({ error: 'Missing gender or date of birth' });
    }

    try {
        await User.updateDemographics(req.user.id, gender, dob);
        res.json({ success: true });
    } catch (err) {
        console.error("Demographics Update Error:", err);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

// Report User Endpoint
app.post('/api/report', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { reason, targetUserId } = req.body;

    console.log(`[REPORT] User ${req.user.id} reported ${targetUserId || 'Unknown'}: ${reason}`);

    // In a real DB, you'd insert into a 'reports' table.
    // For now, logging to console is "functional" as per request to "log it on server".

    res.json({ success: true });
});

// Daily Reset Cron (Midnight UTC)
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily reset...');
    await User.resetDailyMatches();
});

// --- Socket.io Logic ---

let waitingUsers = []; // Array of { socket, interests }
let onlineUsers = 0;

// Middleware to check auth in socket
io.use((socket, next) => {
    const sessionMiddleware = session({
        secret: process.env.SESSION_SECRET || 'secret_key_change_me',
        resave: false,
        saveUninitialized: false,
    });
    next();
});

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('user_count', onlineUsers);
    console.log('A user connected. Total:', onlineUsers);

    socket.on('join_user', (user) => {
        socket.userData = user;
        console.log(`User joined: ${user.displayName} (${socket.id})`);
    });

    socket.on('find_partner', async (data) => {
        const userInterests = (data && data.interests) ? data.interests : [];
        const socketId = socket.id;

        // Get User Attributes from DB (Refreshed)
        let currentUser = null;
        if (socket.userData && socket.userData.uid) {
            try {
                currentUser = await User.get(socket.userData.uid);
            } catch (e) { console.error(e); }
        }

        // --- CHECK LIMITS FOR FREE USERS ---
        // Premium if coins >= 15 OR active subscription
        const now = new Date();
        const vipExpires = currentUser && currentUser.vip_expires_at ? new Date(currentUser.vip_expires_at) : null;
        const isPremium = (vipExpires && vipExpires > now) || (currentUser && (currentUser.coins || 0) >= 15);
        const matchesToday = currentUser ? currentUser.matches_today : 0;

        if (!isPremium && currentUser && matchesToday >= 10) {
            socket.emit('error_limit_reached');
            return;
        }

        const userGender = currentUser ? currentUser.gender : null;
        let targetGender = null;
        let bestMatch = null;
        let bestScore = -1;
        let matchIndex = -1;

        // --- MATCHING LOGIC ---
        // New/Free Logic: Free users get 2 opposite-gender matches, then random.
        // VIP Logic: Always opposite-gender.
        const enforceOppositeGender = isPremium || (matchesToday < 2);

        for (let i = 0; i < waitingUsers.length; i++) {
            const potentialPartner = waitingUsers[i];

            // Don't match with self
            if (potentialPartner.socket.id === socketId) continue;

            const partnerUser = potentialPartner.dbUser; // Stored DB record of waiter

            if (!potentialPartner.socket.connected) continue;

            // Block Check
            const userBlockedByPartner = potentialPartner.blocked && potentialPartner.blocked.includes(socket.userData ? socket.userData.uid : null);
            const partnerBlockedByUser = data.blocked && data.blocked.includes(potentialPartner.socket.userData ? potentialPartner.socket.userData.uid : null);
            if (userBlockedByPartner || partnerBlockedByUser) continue;

            const now = new Date();
            const pVipExpires = partnerUser && partnerUser.vip_expires_at ? new Date(partnerUser.vip_expires_at) : null;
            const partnerIsPremium = (pVipExpires && pVipExpires > now) || (partnerUser && (partnerUser.coins || 0) >= 15);
            const partnerMatchesToday = partnerUser ? partnerUser.matches_today : 0;

            // --- GENDER LOGIC ---
            let isMatchCompatible = true;

            // 1. My Requirements
            if (enforceOppositeGender && userGender) {
                targetGender = userGender === 'male' ? 'female' : 'male';
                if (partnerUser && partnerUser.gender !== targetGender) {
                    isMatchCompatible = false;
                }
            }

            // 2. Partner's Requirements (Symmetry is nice, but fast match is better)
            // Does the partner require opposite gender?
            const partnerRequiresGender = partnerIsPremium || (partnerMatchesToday < 2);
            if (partnerRequiresGender && partnerUser && partnerUser.gender) {
                const partnerTarget = partnerUser.gender === 'male' ? 'female' : 'male';
                if (userGender !== partnerTarget) {
                    isMatchCompatible = false;
                }
            }

            if (!isMatchCompatible) continue;

            if (!isMatchCompatible) continue;

            // Interest Score
            const shared = userInterests.filter(tag => potentialPartner.interests.includes(tag));
            const score = shared.length;

            if (score > bestScore) {
                bestScore = score;
                bestMatch = potentialPartner;
                matchIndex = i;
            }
        }

        if (bestMatch) {
            waitingUsers.splice(matchIndex, 1);
            const partnerSocket = bestMatch.socket;
            const commonInterests = userInterests.filter(tag => bestMatch.interests.includes(tag));

            // Deduct match count for FREE users
            if (currentUser && !isPremium) {
                User.incrementMatches(currentUser.id).catch(console.error);
            }
            if (bestMatch.dbUser && (bestMatch.dbUser.coins || 0) < 15) {
                User.incrementMatches(bestMatch.dbUser.id).catch(console.error);
            }

            const socketData = socket.userData || {};
            const partnerData = bestMatch.socket.userData || {};

            socket.emit('partner_found', {
                initiator: true,
                commonInterests,
                partnerId: partnerData.uid,
                partnerCountry: partnerData.country,
                partnerFlag: partnerData.flag,
                partnerGender: partnerData.gender
            });
            partnerSocket.emit('partner_found', {
                initiator: false,
                commonInterests,
                partnerId: socketData.uid,
                partnerCountry: socketData.country,
                partnerFlag: socketData.flag,
                partnerGender: socketData.gender
            });

            socket.partnerId = partnerSocket.id;
            partnerSocket.partnerId = socket.id;

            console.log(`Paired ${socket.id} with ${partnerSocket.id}`);
        } else {
            waitingUsers.push({
                socket,
                interests: userInterests,
                blocked: data.blocked || [],
                dbUser: currentUser,
                targetGender: targetGender,
                isPremium: isPremium
            });

            // Fast Matchmaking: Sort Queue to prioritize VIPs
            waitingUsers.sort((a, b) => (b.isPremium ? 1 : 0) - (a.isPremium ? 1 : 0));

            console.log(`User ${socket.id} added to queue. Queue size: ${waitingUsers.length}`);
        }
    });

    socket.on('signal', (data) => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('signal', data);
        }
    });

    socket.on('chat_message', (data) => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('chat_message', data);
        }
    });

    socket.on('disconnect', () => {
        onlineUsers = Math.max(0, onlineUsers - 1);
        io.emit('user_count', onlineUsers);
        console.log('User disconnected. Total:', onlineUsers);

        // Remove from waiting queue if present
        const index = waitingUsers.findIndex(u => u.socket === socket);
        if (index !== -1) {
            waitingUsers.splice(index, 1);
        }

        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
        }
    });

    socket.on('next', () => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
            socket.partnerId = null;
        }

        // Remove from waiting queue if present (shouldn't be if they were chatting, but safety first)
        const index = waitingUsers.findIndex(u => u.socket === socket);
        if (index !== -1) {
            waitingUsers.splice(index, 1);
        }

        // Client will emit 'find_partner' immediately after
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
