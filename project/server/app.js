const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 5500;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static('public'));

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for the dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Handle login request
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Implement your authentication logic here
  if (email === 'user@example.com' && password === 'password') {
    res.redirect('/dashboard');
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
