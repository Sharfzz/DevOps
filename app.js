const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const app = express();
const PORT = 8080;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/campus_portal')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));

// Session & Flash
app.use(session({
  secret: 'campusportalsecret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────

// Home page (skeleton)
app.get('/', (req, res) => {
  res.render('index');
});

// Room booking routes
const roomRoutes = require('./routes/rooms');
app.use('/rooms', roomRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});