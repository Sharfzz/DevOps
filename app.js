const express = require('express');
const app = express();
const PORT = 8080;

// Tell Express to use EJS as the templating engine
app.set('view engine', 'ejs');

// When a user visits the root URL ('/'), render the index.ejs file
app.get('/', (req, res) => {
    res.render('index');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running successfully on http://localhost:${PORT}`);
});