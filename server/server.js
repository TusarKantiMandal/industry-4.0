const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const PORT = 3000;
const fs = require("fs");

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Add middleware to parse JSON data
app.use(express.json());

const cookieParser = require("cookie-parser");
app.use(cookieParser());

const jwt = require("jsonwebtoken");
const JWT_SECRET = "SECRET_KEY"; // TODO: get from .env

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://127.0.0.1:3001"); // <-- Match frontend origin
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

app.use("/admin", (req, res, next) => {
  const token = req.cookies.token;

  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (req.path.startsWith("/it")) {
      if (decoded.role !== "itAdmin") {
        return res.redirect(
          "/error.html?type=auth&errorCode=403&details=IT Admin only"
        );
      }
    } else {
      if (!["admin", "itAdmin"].includes(decoded.role)) {
        return res.redirect(
          "/error.html?type=auth&errorCode=403&details=Unauthorized"
        );
      }
    }

    next();
  } catch (err) {
    return res.redirect(
      "/error.html?type=auth&errorCode=401&details=Invalid token"
    );
  }
});

const adminRoutes = require("./admin");
const apiRoutes = require("./api");
app.use("/admin", adminRoutes);
app.use("/api", verifyItAdmin, apiRoutes);

app.get("/page1.html", verifyToken, (req, res) => {
  const usersPlant = req.user.plant_id;
  const plant = req.query.plant;

  if (plant === undefined || plant === "") {
    return res.redirect("/page1.html?plant=" + usersPlant);
  }

  if (!plant) {
    return res.sendFile(path.join(__dirname, "public", "404.html"));
  }

  if (String(usersPlant) !== String(plant)) {
    return res.sendFile(path.join(__dirname, "public", "403.html"));
  }

  res.sendFile(path.join(__dirname, "public", "page1.html"));
});

app.use(express.static(path.join(__dirname, "public")));

// Initialize SQLite database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to SQLite database.");

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS plants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fullname TEXT NOT NULL,
          cell TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          plant_id INTEGER NOT NULL,
          role TEXT DEFAULT 'user',
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plant_id) REFERENCES plants(id)
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS machines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          plant_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plant_id) REFERENCES plants(id)
        );
      `);

      db.run(
        `CREATE TABLE IF NOT EXISTS user_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          machine_id INTEGER NOT NULL,
          skill TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (machine_id) REFERENCES machines(id),
          UNIQUE(user_id, machine_id)
        );
      `,
        (err) => {
          if (err) {
            console.error("Error creating tables", err.message);
          } else {
            console.log("All tables created successfully.");
          }
        }
      );
    });
  }
});

// Handle signup form submission
app.post("/signup", (req, res) => {
  const { fullname, plant_id, cell, email, username, password } = req.body;

  if (!fullname || !plant_id || !cell || !email || !username || !password) {
    return res.redirect("/error.html?type=signup&errorCode=400");
  }

  const insertUserQuery = `
    INSERT INTO users (fullname, cell, email, username, password, plant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    insertUserQuery,
    [fullname, cell, email, username, password, plant_id],
    function (err) {
      if (err) {
        console.error("Signup error:", err.message);
        return res.sendFile(path.join(__dirname, "public", "error.html"));
      }

      console.log(`User created with ID ${this.lastID}`);
      res.sendFile(path.join(__dirname, "public", "success.html"));
    }
  );
});

app.get("/login", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.sendFile(path.join(__dirname, "public", "login.html"));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Invalid token → show login
      return res.sendFile(path.join(__dirname, "public", "login.html"));
    }

    const plantId = decoded.plant_id;
    // Redirect to protected page with skill query
    return res.redirect(`/page1.html?plant=${plantId}`);
  });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });
  return res.status(200).json({ message: "Logged out" });
});

// Handle login - Support both form and JSON data
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const loginQuery = `
    SELECT * FROM users WHERE username = ? AND password = ?
  `;

  db.get(loginQuery, [username, password], (err, row) => {
    if (err) {
      console.error("Login error", err.message);
      // Return error as JSON
      return res.status(500).json({ success: false, message: "Server error" });
    }

    if (!row) {
      return res.status(401).json({
        success: false,
        message: "No user exists or wrong credentials!",
      });
    }

    if (!row.active) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive.",
      });
    }

    console.log(`User "${username}" logged in.`);

    const userData = {
      success: true,
      id: row.id,
      fullname: row.fullname,
      plant_id: row.plant_id,
      cell: row.cell,
      email: row.email,
      username: row.username,
      role: row.role,
      active: row.active,
    };

    delete userData.password;

    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 1 * 60 * 60 * 1000 * 24 * 30, // 30 days
    });

    return res.status(200).json(userData);
  });
});

app.get("/me", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
   SELECT 
    u.id, 
    u.fullname, 
    u.cell, 
    u.email, 
    u.username,
    p.id as plant_id, 
    p.name as plant_name,
    m.id as machine_id, 
    m.name as machine_name,
    COALESCE(us.skill, 'L1') AS skill
    FROM users u
    JOIN plants p ON u.plant_id = p.id
    JOIN machines m ON m.plant_id = p.id
    LEFT JOIN user_skills us ON us.user_id = u.id AND us.machine_id = m.id
    WHERE u.id = ?
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).send("DB error");

    if (!rows.length) return res.status(404).send("User not found");

    const user = rows[0];

    const skillCards = rows
      .filter((row) => row.machine_name)
      .map((row) => {
        const levelText = row.skill;
        const level = parseInt(levelText.charAt(1));
        const levelClass = `level-${level}`;
        const icon =
          level === 3
            ? "fa-robot"
            : level === 2
            ? "fa-microchip"
            : "fa-drafting-compass";

        return `
          <div class="skill-card ${levelClass}">
            <div class="skill-level-indicator"></div>
            <div class="skill-level-text">${levelText}</div>
            <div class="skill-card-content">
              <div class="skill-icon">
                <i class="fas ${icon}"></i>
              </div>
              <h3 class="skill-title">${row.machine_name}</h3>
            </div>
          </div>
        `;
      })
      .join("");

    // Read HTML file
    const filePath = path.join(__dirname, "public", "profile.html");
    fs.readFile(filePath, "utf8", (err, html) => {
      if (err) return res.status(500).send("Could not load profile template");

      let rendered = html
        .replace(/{{username}}/g, user.username)
        .replace(/{{fullname}}/g, user.fullname)
        .replace(/{{email}}/g, user.email)
        .replace(/{{cell}}/g, user.cell)
        .replace(/{{userId}}/g, user.id)
        .replace(/{{plantName}}/g, user.plant_name)
        .replace(
          /{{username.charAt\(0\).toUpperCase\(\)}}/g,
          user.fullname.charAt(0).toUpperCase()
        )
        .replace(/{{skills}}/g, skillCards);

      res.send(rendered);
    });
  });
});

app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
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
  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );
    req.user = decoded;
    next();
  });
}

function verifyItAdmin(req, res, next) {
  const token = req.cookies.token;
  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );
    req.user = decoded;
    if (decoded.role != "itAdmin") return res.redirect("/403.html");
    next();
  });
}
