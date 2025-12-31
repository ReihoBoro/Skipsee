require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const socketIo = require("socket.io");
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Config
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
  function (accessToken, refreshToken, profile, cb) {
    // In a real app, findOrCreateUser(profile)
    const user = {
      id: `google_${profile.id}`,
      name: profile.displayName,
      type: 'google',
      photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null
    };
    return cb(null, user);
  }
));

// Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=login_failed' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/auth/me', (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not logged in' });
  }
});

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
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
const connectedUsers = {}; // Map socket.id -> user info

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('register', (user) => {
    connectedUsers[socket.id] = user;
    console.log(`User registered: ${user.name} (${user.id})`);
  });

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

      console.log(`Matching ${socket.id} with ${partner.id} `);

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
    delete connectedUsers[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} `);
});
