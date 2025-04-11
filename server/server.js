const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Add middleware to parse JSON data
app.use(express.json());

const cookieParser = require('cookie-parser');
app.use(cookieParser());

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'SECRET_KEY'; // TODO: get from .env

// protected files
app.get('/page1.html', verifyToken, (req, res) => {
  const userSkill = req.user.skill;
  const requestedSkill = req.query.skill;

  if (!requestedSkill) {
    return res.sendFile(path.join(__dirname, 'public', '404.html'));
  }

  if (userSkill !== requestedSkill) {
    return res.sendFile(path.join(__dirname, 'public', '403.html'));
  }

  // Serve the actual HTML page
  res.sendFile(path.join(__dirname, 'public', 'page1.html'));
});


// Serve static files (like HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));


// Enable CORS for all routes (helpful for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:3001'); // <-- Match frontend origin
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true'); // Only if you send cookies/auth
  next();
});

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        plantname TEXT NOT NULL,
        cell TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        skill TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table', err.message);
      } else {
        console.log('Users table ready.');
      }
    });
  }
});

// Handle signup form submission
app.post('/signup', (req, res) => {
  const { fullname, PlantName, cell, email, username, password, skill } = req.body;
  const insertQuery = `
    INSERT INTO users (fullname, plantname, cell, email, username, password, skill)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(insertQuery, [fullname, PlantName, cell, email, username, password, skill], function (err) {
    if (err) {
      console.error('Error inserting data', err.message);
      res.status(400).json({ success: false, message: err.message });
    } else {
      console.log(`New user added with ID ${this.lastID}`);
      res.status(201).json({ success: true, id: this.lastID });
    }
  });
});

app.get('/login', (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Invalid token → show login
      return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }

    const userSkill = decoded.skill;
    // Redirect to protected page with skill query
    return res.redirect(`/page1.html?skill=${userSkill}`);
  });
});

app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  });
  return res.status(200).json({ message: 'Logged out' });
});

// Handle login - Support both form and JSON data
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const loginQuery = `
    SELECT * FROM users WHERE username = ? AND password = ?
  `;
  
  db.get(loginQuery, [username, password], (err, row) => {
    if (err) {
      console.error('Login error', err.message);
      // Return error as JSON
      return res.status(500).json({ success: false, message: 'Server error' });
    } 
    
    if (!row) {
      // Return authentication failure as JSON
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    
    console.log(`User "${username}" logged in.`);
    
      const userData = {
        success: true,
        id: row.id,
        fullname: row.fullname,
        plantname: row.plantname,
        cell: row.cell,
        email: row.email,
        username: row.username,
        skill: row.skill
      };
      
      delete userData.password;

      
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: false, 
        sameSite: 'Lax', 
        maxAge: 1 * 60 * 60 * 1000 * 24 * 30, // 30 days
      });
  
      return res.status(200).json(userData);
  });
});

app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  } else {
    next();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).send('Unauthorized: No token');

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Forbidden: Invalid token');
    req.user = decoded;
    next();
  });
}