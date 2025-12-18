require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const cron = require('node-cron');
const { User } = require('./database');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Environment Variable Check ---
const requiredEnvVars = [
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
    'SESSION_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
const placeholderValues = [
    'your_google_client_id', 'your_google_client_secret',
    'your_facebook_app_id', 'your_facebook_app_secret',
    'your_super_secret_session_key'
];

const invalidEnvVars = requiredEnvVars.filter(key => {
    const value = process.env[key];
    return value && placeholderValues.includes(value);
});

if (missingEnvVars.length > 0 || invalidEnvVars.length > 0) {
    console.error('----------------------------------------------------------------');
    console.error('ERROR: Environment Configuration Issue');

    if (missingEnvVars.length > 0) {
        console.error('Missing required environment variables:');
        missingEnvVars.forEach(key => console.error(`  - ${key}`));
    }

    if (invalidEnvVars.length > 0) {
        console.error('The following variables are set to default placeholder values:');
        invalidEnvVars.forEach(key => console.error(`  - ${key}`));
        console.error('You must replace these with REAL keys from Google/Facebook Developer Consoles.');
    }

    console.error('----------------------------------------------------------------');
    console.error('Please set these variables in your .env file (local) or Render Dashboard (production).');
    console.error('See DEPLOYMENT.md for instructions on how to get these keys.');
    console.error('----------------------------------------------------------------');
    // process.exit(1); // Exit with error code
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

// Facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || "http://localhost:3000/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
},
    (accessToken, refreshToken, profile, done) => {
        const user = {
            id: profile.id,
            displayName: profile.displayName,
            provider: 'facebook',
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

// Serve login.html on root, but if logged in, redirect to app
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
    res.sendFile(path.join(__dirname, "public", "intro.html"));
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
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
    } else {
        res.status(401).json({ authenticated: false });
    }
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
    'vip_2_weeks': { durationDays: 14, amount: 19900, currency: 'INR', name: '2 Weeks' },
    'vip_1_month': { durationDays: 30, amount: 120000, currency: 'INR', name: '1 Month' },
    'vip_5_months': { durationDays: 150, amount: 200000, currency: 'INR', name: '5 Months' },
    'vip_7_months': { durationDays: 210, amount: 550000, currency: 'INR', name: '7 Months' },
    'vip_1_year': { durationDays: 365, amount: 900000, currency: 'INR', name: '1 Year' }
};

app.post('/api/payment/create-order', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });

    const { packageId, planId } = req.body;
    let options = {};

    if (planId && VIP_PLANS[planId]) {
        const plan = VIP_PLANS[planId];
        options = {
            amount: plan.amount, // Already in subunits
            currency: plan.currency,
            receipt: "sub_rcptid_" + req.user.id + "_" + Date.now(),
            notes: { userId: req.user.id, planId: planId, type: 'subscription' }
        };
    } else if (packageId && COIN_PACKAGES[packageId]) {
        const pkg = COIN_PACKAGES[packageId];
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
                await User.addCoins(req.user.id, pkg.coins);
                res.json({ success: true, newCoins: pkg.coins });
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

// Daily Reset Cron (Midnight UTC)
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily reset...');
    await User.resetDailyMatches();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

        // Remove user from queue if they are already there
        const existingIndex = waitingUsers.findIndex(u => u.socket === socket);
        if (existingIndex !== -1) waitingUsers.splice(existingIndex, 1);

        let bestMatch = null;
        let bestScore = -1;
        let matchIndex = -1;

        // --- MATCHING LOGIC ---
        for (let i = 0; i < waitingUsers.length; i++) {
            const potentialPartner = waitingUsers[i];
            const partnerUser = potentialPartner.dbUser; // Stored DB record of waiter

            if (!potentialPartner.socket.connected) continue;

            // Block Check
            const userBlockedByPartner = potentialPartner.blocked && potentialPartner.blocked.includes(socket.userData ? socket.userData.uid : null);
            const partnerBlockedByUser = data.blocked && data.blocked.includes(potentialPartner.socket.userData ? potentialPartner.socket.userData.uid : null);
            if (userBlockedByPartner || partnerBlockedByUser) continue;

            const pVipExpires = partnerUser && partnerUser.vip_expires_at ? new Date(partnerUser.vip_expires_at) : null;
            const partnerIsPremium = (pVipExpires && pVipExpires > now) || (partnerUser && (partnerUser.coins || 0) >= 15);

            // --- GENDER LOGIC ---
            let isMatchCompatible = true;

            if (isPremium && userGender) {
                const targetGender = userGender === 'male' ? 'female' : 'male';
                if (partnerUser && partnerUser.gender !== targetGender) {
                    isMatchCompatible = false;
                }
            }

            // Also check the OTHER person's requirements
            if (partnerIsPremium && partnerUser.gender) {
                const partnerTargetGender = partnerUser.gender === 'male' ? 'female' : 'male';
                if (userGender !== partnerTargetGender) {
                    isMatchCompatible = false;
                }
            }

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
                partnerFlag: partnerData.flag
            });
            partnerSocket.emit('partner_found', {
                initiator: false,
                commonInterests,
                partnerId: socketData.uid,
                partnerCountry: socketData.country,
                partnerFlag: socketData.flag
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
