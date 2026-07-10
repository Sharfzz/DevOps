// TESTING GIT BRANCH SWITCHING
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
console.log('Debug - MONGO_URI exists:', !!process.env.MONGO_URI);
const mongoose = require('mongoose');
const express = require('express');
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'campus-portal-secret',
    resave: false,
    saveUninitialized: false
}));

mongoose.connect(process.env.MONGO_URI, { family: 4 })
    .then(() => console.log(' MongoDB Connected Successfully to CampusPortal!'))
    .catch(err => console.error(' MongoDB Connection Error:', err));
const PORT = 8080;

// Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/campus_portal')
//   .then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.error('MongoDB connection error:', err));

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// When a user visits the root URL ('/'), render the index.ejs file
app.get('/', (req, res) => {
    const profile = req.session?.user || {
        fullName: 'Guest User',
        campusId: 'GUEST001',
        role: 'Student',
        recoveryKey: 'CP-1234567890'
    };
    res.render('index', { profile });
});

// Room booking routes
const roomRoutes = require('./routes/rooms');
app.use('/rooms', roomRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});