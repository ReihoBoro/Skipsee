const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware to serve static files
// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Expose public config safely
app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID
    });
});

// State
let users = {}; // socket.id -> { gender, country, searching, ... }
let queue = []; // Array of socket IDs waiting for a match

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Initialize user
    users[socket.id] = {
        id: socket.id,
        gender: 'all',
        country: 'Global',
        searching: false,
        partnerId: null
    };

    // Broadcast online user count
    io.emit('online-count', Object.keys(users).length);

    // Handle user settings updates and start search
    socket.on('start-search', (data) => {
        const { gender, country, interests } = data;

        // Update user preferences
        if (users[socket.id]) {
            users[socket.id].gender = gender || 'all';
            users[socket.id].country = country || 'Global';
            users[socket.id].interests = interests || [];
            users[socket.id].searching = true;
        }

        // Add to queue if not already there
        if (!queue.includes(socket.id)) {
            queue.push(socket.id);
        }

        // Try to match
        matchUser(socket.id);
    });

    socket.on('stop-search', () => {
        if (users[socket.id]) {
            users[socket.id].searching = false;
        }
        queue = queue.filter(id => id !== socket.id);
    });

    // ... (rest of listeners)

    function matchUser(socketId) {
        const user = users[socketId];
        if (!user || !user.searching) return;

        // Find best match in queue
        let bestMatchId = null;
        let maxScore = -1;

        for (const candidateId of queue) {
            if (candidateId === socketId) continue;

            const candidate = users[candidateId];
            if (!candidate || !candidate.searching) continue;

            // 1. Check Mandatory Filters (Country, Gender)
            if (user.country !== 'Global' && candidate.country !== user.country) continue;
            if (candidate.country !== 'Global' && candidate.country !== user.country) continue;
            if (user.gender !== 'all' && candidate.gender !== 'all' && user.gender !== candidate.gender) continue; // Simplified

            // 2. Calculate Interest Score
            let score = 0;
            if (user.interests && user.interests.length > 0 && candidate.interests && candidate.interests.length > 0) {
                const intersection = user.interests.filter(tag => candidate.interests.includes(tag));
                score = intersection.length;
            }

            // 3. Select Best Score
            // We prioritize score, but if scores are equal, we take the first found (FIFOish)
            if (score > maxScore) {
                maxScore = score;
                bestMatchId = candidateId;
            }
        }

        if (bestMatchId) {
            const matchId = bestMatchId;

            // Connect them
            users[socketId].searching = false;
            users[socketId].partnerId = matchId;
            users[matchId].searching = false;
            users[matchId].partnerId = socketId;

            // Remove both from queue
            queue = queue.filter(id => id !== socketId && id !== matchId);

            // Notify both
            // Pass interest info if needed, e.g. "Matched on: Music"
            const commonInterests = users[socketId].interests.filter(tag => users[matchId].interests.includes(tag));

            io.to(socketId).emit('match-found', { initiator: true, partnerId: matchId, country: users[matchId].country, commonTags: commonInterests });
            io.to(matchId).emit('match-found', { initiator: false, partnerId: socketId, country: users[socketId].country, commonTags: commonInterests });

            console.log(`Matched ${socketId} with ${matchId} (Score: ${maxScore})`);
        }
    }

    // Handle Signaling
    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', payload);
    });

    // Chat Messages
    socket.on('message', (payload) => {
        const { message } = payload;
        const user = users[socket.id];
        if (user && user.partnerId) {
            io.to(user.partnerId).emit('message', { sender: 'stranger', message });
        }
    });

    // Skip/Disconnect Action
    socket.on('skip', () => {
        const user = users[socket.id];
        if (user && user.partnerId) {
            const partnerId = user.partnerId;
            const partner = users[partnerId];

            // Notify partner
            io.to(partnerId).emit('partner-disconnected');

            // Reset states
            if (partner) {
                partner.partnerId = null;
                // Partner might auto-requeue or wait, depending on frontend logic.
                // Usually skip means *I* leave, sending them back to void or search.
            }
            user.partnerId = null;

            // Re-queue current user immediately
            // socket.emit('skipped'); // Acknowledge skip
            // Logic handled in start-search usually, but let's assume frontend calls start-search again.
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        const user = users[socket.id];
        if (user && user.partnerId) {
            io.to(user.partnerId).emit('partner-disconnected');
            if (users[user.partnerId]) {
                users[user.partnerId].partnerId = null;
            }
        }

        // Remove from queue
        queue = queue.filter(id => id !== socket.id);

        // Remove from users
        delete users[socket.id];

        // Broadcast online user count
        io.emit('online-count', Object.keys(users).length);
    });
});



const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
