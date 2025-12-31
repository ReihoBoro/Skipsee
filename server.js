const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev simplicity
    methods: ["GET", "POST"]
  }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store waiting users
let waitingUsers = [];
const partners = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', () => {
    console.log(`User ${socket.id} requested to join`);

    // Filter out disconnected sockets from waiting pool just in case
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id && user.connected);

    if (waitingUsers.length > 0) {
      // Get a random partner or just the next one
      const partner = waitingUsers.pop();

      if (partner.id === socket.id) {
        // Should not happen due to filter above, but safety check
        waitingUsers.push(socket);
        socket.emit('waiting');
        return;
      }

      console.log(`Matching ${socket.id} with ${partner.id}`);

      // Notify both users
      io.to(socket.id).emit('match', { partnerId: partner.id, initiator: true });
      io.to(partner.id).emit('match', { partnerId: socket.id, initiator: false });

      partners[socket.id] = partner.id;
      partners[partner.id] = socket.id;
    } else {
      // No one waiting, add to queue
      waitingUsers.push(socket);
      console.log(`User ${socket.id} added to waiting list`);
      socket.emit('waiting');
    }
  });

  socket.on('signal', (data) => {
    io.to(data.target).emit('signal', {
      signal: data.signal,
      sender: socket.id
    });
  });

  socket.on('message', (data) => {
    const partnerId = partners[socket.id] || data.target;
    if (partnerId) {
      io.to(partnerId).emit('message', {
        message: data.message,
        sender: socket.id
      });
    }
  });

  socket.on('skip', (data) => {
    const partnerId = partners[socket.id] || (data && data.target);
    if (partnerId) {
      io.to(partnerId).emit('remote-skip');
      delete partners[partnerId];
    }
    delete partners[socket.id];
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from waiting list if present
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);

    // Notify partner if connected
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('user-disconnected');
      delete partners[partnerId];
    }
    delete partners[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
