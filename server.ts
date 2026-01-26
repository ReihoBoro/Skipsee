import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import next from 'next';
import path from 'path';
import dotenv from 'dotenv'; // Load environment variables
dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = parseInt(process.env.PORT || '3000', 10);

// Use a separate type or interface if needed, but keeping it simple
interface User {
    id: string;
    identity: string; // 'male' | 'female'
    preference: string; // 'male' | 'female' | 'all'
    country: string;
    searching: boolean;
    partnerId: string | null;
    interests?: string[];
}

app.prepare().then(() => {
    const server = express();
    const httpServer = createServer(server);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // NOTE: Next.js handles static files in public folder automatically, so we don't need express.static
    // server.use(express.static(path.join(__dirname, 'public')));

    // Expose public config safely
    server.get('/api/config', (req: Request, res: Response) => {
        res.json({
            googleClientId: process.env.GOOGLE_CLIENT_ID
        });
    });

    // --- LOGIC FROM OLD SERVER.JS STARTS HERE ---

    // State
    let users: Record<string, User> = {}; // socket.id -> { identity, preference, country, ... }
    let queue: string[] = []; // Array of socket IDs waiting for a match

    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        // Initialize user
        users[socket.id] = {
            id: socket.id,
            identity: 'unknown',
            preference: 'all',
            country: 'Global',
            searching: false,
            partnerId: null
        };

        // Broadcast online user count
        io.emit('online-count', Object.keys(users).length);

        // Handle user settings updates and start search
        socket.on('start-search', (data: any) => {
            const { gender, identity, country, interests } = data; // gender = Preference, identity = Self

            // Update user preferences
            if (users[socket.id]) {
                users[socket.id].preference = gender || 'all';
                users[socket.id].identity = identity || 'unknown';
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

        // Loop match logic
        function matchUser(socketId: string) {
            const user = users[socketId];
            if (!user || !user.searching) return;

            // Find best match in queue
            let bestMatchId: string | null = null;
            let maxScore = -1;

            for (const candidateId of queue) {
                if (candidateId === socketId) continue;

                const candidate = users[candidateId];
                if (!candidate || !candidate.searching) continue;

                // 1. Check Mandatory Filters (Country)
                if (user.country !== 'Global' && candidate.country !== 'Global' && user.country !== candidate.country) {
                    continue;
                }

                // 2. Check Gender Compatibility (Bidirectional)
                // Match if: (User Pref matches Candidate Identity) AND (Candidate Pref matches User Identity)

                const userMatchesCandidate = (user.preference === 'all') || (user.preference === candidate.identity);
                const candidateMatchesUser = (candidate.preference === 'all') || (candidate.preference === user.identity);

                if (!userMatchesCandidate || !candidateMatchesUser) {
                    continue; // Skip if either preference is not met
                }

                // 3. Calculate Interest Score
                let score = 0;
                const userInterests = user.interests || [];
                const candidateInterests = candidate.interests || [];

                if (userInterests.length > 0 && candidateInterests.length > 0) {
                    const intersection = userInterests.filter(tag => candidateInterests.includes(tag));
                    score = intersection.length;

                    // Bonus: If exact interest match, boost score
                    if (score > 0) score += 1;
                }

                // 4. Select Best Score
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
                const commonInterests = (users[socketId].interests || []).filter(tag => (users[matchId].interests || []).includes(tag));

                io.to(socketId).emit('match-found', { initiator: true, partnerId: matchId, country: users[matchId].country, commonTags: commonInterests });
                io.to(matchId).emit('match-found', { initiator: false, partnerId: socketId, country: users[socketId].country, commonTags: commonInterests });

                console.log(`Matched ${socketId} (${users[socketId].identity}) with ${matchId} (${users[matchId].identity})`);
            }
        }

        // Handle Signaling
        socket.on('offer', (payload: any) => {
            io.to(payload.target).emit('offer', payload);
        });

        socket.on('answer', (payload: any) => {
            io.to(payload.target).emit('answer', payload);
        });

        socket.on('ice-candidate', (payload: any) => {
            io.to(payload.target).emit('ice-candidate', payload);
        });

        // Chat Messages
        socket.on('message', (payload: any) => {
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
                }
                user.partnerId = null;

                // Note: Frontend usually re-emits start-search
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

    // --- LOGIC END ---

    server.all('*', (req: any, res: any) => {
        return handle(req, res);
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
