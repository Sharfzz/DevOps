const express = require('express');
const app = express();
const PORT = 8080;

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// When a user visits the root URL ('/'), render the index.ejs file
app.get('/', (req, res) => {
    res.render('index');
});

// Middleware to parse URL-encoded bodies (form data)
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { userId, password } = req.body;
    if (userId === 'admin123' && password === 'password') {
        res.redirect('/');
    } else {
        res.send('Invalid credentials');
    }
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    console.log('Register Payload:', req.body);
    res.redirect('/login');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
});