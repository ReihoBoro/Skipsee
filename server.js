require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;


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
        return done(null, user);
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
        return done(null, user);
    }
));

// --- Routes ---

// Serve login.html on root, but if logged in, redirect to app
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
    res.sendFile(path.join(__dirname, "public", "login.html"));
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

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

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

    socket.on('find_partner', (data) => {
        const userInterests = (data && data.interests) ? data.interests : [];

        // Find best match
        let bestMatch = null;
        let bestScore = -1;
        let matchIndex = -1;

        // Iterate through waiting users to find the one with most shared interests
        for (let i = 0; i < waitingUsers.length; i++) {
            const potentialPartner = waitingUsers[i];

            // Calculate shared interests
            const shared = userInterests.filter(tag => potentialPartner.interests.includes(tag));
            const score = shared.length;

            // Prioritize higher score. If scores are equal, we stick with the first one found (FIFO-ish for same score)
            // Note: If we wanted strict FIFO for same score, this loop order (0 to length) preserves it naturally 
            // because we only update if score > bestScore (strictly greater).
            // However, if we want to prioritize ANY match over NO match, we just need score >= 0.
            // But we want to maximize score.

            if (score > bestScore) {
                bestScore = score;
                bestMatch = potentialPartner;
                matchIndex = i;
            }
        }

        if (bestMatch) {
            // Match found
            waitingUsers.splice(matchIndex, 1); // Remove partner from queue
            const partnerSocket = bestMatch.socket;

            const commonInterests = userInterests.filter(tag => bestMatch.interests.includes(tag));

            // Notify both users
            socket.emit('partner_found', { initiator: true, commonInterests: commonInterests });
            partnerSocket.emit('partner_found', { initiator: false, commonInterests: commonInterests });

            // Store partner ID
            socket.partnerId = partnerSocket.id;
            partnerSocket.partnerId = socket.id;

            console.log(`Paired ${socket.id} with ${partnerSocket.id} (Shared: ${commonInterests.join(', ')})`);
        } else {
            // No one waiting or queue empty, add to queue
            waitingUsers.push({ socket: socket, interests: userInterests });
            console.log(`User ${socket.id} added to queue with interests: ${userInterests.join(', ')}`);
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
        onlineUsers--;
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
