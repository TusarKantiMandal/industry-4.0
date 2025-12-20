const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const PORT = 3000;
const fs = require("fs");
const { getUserById } = require('./db');

const cors = require("cors");

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
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

const ADMIN_ROLES = ["admin", "ptt", "itAdmin"];

app.use("/admin", (req, res, next) => {
  const token = req.cookies.token;

  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (!ADMIN_ROLES.includes(decoded.role)) {
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Unauthorized"
      );
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
const accessCodeRoutes = require("./accessCodes");
const openRoutes = require("./openRoutes");
const checkSheetRoutes = require("./checkSheet");
const { sendEmail } = require("./email");
app.use("/admin", verifyItAdmin, adminRoutes); // TODO: add verifyAdmin middleware

// PTT Users Endpoint (Accessible to all logged-in users)
app.get("/api/users/ptt", verifyToken, (req, res) => {
  const query = "SELECT id, fullname, email FROM users WHERE role = 'ptt' AND active = 1 ORDER BY fullname ASC";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching PTT users:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }
    res.json(rows);
  });
});

// Approvers Endpoint (PTT + Admins)
app.get("/api/users/approvers", verifyToken, (req, res) => {
  const query = "SELECT id, fullname, email FROM users WHERE role IN ('ptt', 'admin', 'itAdmin') AND active = 1 ORDER BY fullname ASC";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching approvers:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }
    res.json(rows);
  });
});

app.use("/api/access-codes", verifyToken, accessCodeRoutes);
app.use("/api", verifyItAdmin, apiRoutes);
app.use("/open", openRoutes);
app.use("/machine/:machineId", verifyMachineAccess, checkSheetRoutes);

app.post("/service/send-email", (req, res) => {
  const { email, subject, message, cc } = req.body;
  const user = req.user;
  if (!email || !subject || !message) {
    return res.status(400).json({ error: "Email, subject, and message are required" });
  }
  sendEmail(email, subject, message, cc);
  res.json({ message: "Email sent successfully" });
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.cookies.token;

  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );

    console.log("VerifyToken Decoded:", decoded);

    // Check if this is a temporary session and if the access code is still valid
    if (decoded.is_temp && decoded.access_code_id) {
      console.log(`Verifying temp token for access_code_id: ${decoded.access_code_id}`);
      const query = "SELECT is_active, expires_at FROM temp_access_codes WHERE id = ?";
      db.get(query, [decoded.access_code_id], (err, row) => {
        console.log(`DB Result for access code ${decoded.access_code_id}:`, row);
        if (err || !row || !row.is_active || new Date(row.expires_at) < new Date()) {
          console.log("Access code revoked or expired. Denying access.");
          res.clearCookie("token");
          return res.redirect("/error.html?type=auth&errorCode=403&details=Session Expired or Revoked");
        }
        req.user = decoded;
        next();
      });
    } else {
      // console.log("Standard token verified");
      req.user = decoded;
      next();
    }
  });
}

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
      db.run("PRAGMA foreign_keys = ON;");

      db.run(`
        CREATE TABLE IF NOT EXISTS plants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS cells (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          plant_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, plant_id),
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id TEXT NOT NULL UNIQUE,
          fullname TEXT NOT NULL,
          cell_id INTEGER,
          email TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          plant_id INTEGER,
          role TEXT DEFAULT 'user',
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE SET NULL,
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS machines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          unique_id TEXT NOT NULL UNIQUE,
          minimum_skill INTEGER DEFAULT 1,
          plant_id INTEGER NOT NULL,
          cell_id INTEGER NOT NULL,
          checksheets_count INTEGER DEFAULT 1,
          ip_address TEXT DEFAULT "192.168.10.2",
          port INTEGER DEFAULT 102,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
          FOREIGN KEY (cell_id) REFERENCES cells(id) ON DELETE CASCADE,
          FOREIGN KEY (minimum_skill) REFERENCES skills(id)
        );
      `);

      db.run(
        `
        CREATE TABLE IF NOT EXISTS skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
      );

      db.run(
        `
        CREATE TABLE IF NOT EXISTS user_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          machine_id INTEGER NOT NULL,
          skill_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
          UNIQUE(user_id, machine_id, skill_id)
        );
      `
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ppt_machines(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machine_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`
      );

      // Insert skill levels
      db.run(
        `
        INSERT INTO skills (name) VALUES 
          ('L1'), ('L2'), ('L3')
        ON CONFLICT(name) DO NOTHING;
        `,
        (err) => {
          if (err) {
            console.error("Error inserting into skills table", err.message);
          } else {
            console.log("Skills inserted successfully.");
          }
        }
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS checkpoints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT,
          type TEXT,
          min_value REAL,
          max_value REAL,
          unit TEXT,
          alert_email TEXT,
          time TEXT,
          clit TEXT,
          how TEXT,
          photo_url TEXT,
          db_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
      );

      // Migration: Add db_address column if it doesn't exist
      db.all("PRAGMA table_info(checkpoints);", (err, columns) => {
        if (err) {
          console.error("Error checking checkpoints table schema:", err.message);
        } else {
          const hasDbAddress = columns.some(col => col.name === 'db_address');
          if (!hasDbAddress) {
            console.log("Adding db_address column to checkpoints table...");
            db.run("ALTER TABLE checkpoints ADD COLUMN db_address TEXT;", (err) => {
              if (err) {
                console.error("Error adding db_address column:", err.message);
              } else {
                console.log("db_address column added successfully.");
              }
            });
          }
        }
      });

      db.run(
        `CREATE TABLE IF NOT EXISTS machine_checkpoint (
          checkpoint_id INTEGER NOT NULL,
          machine_id INTEGER NOT NULL,
          page INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          PRIMARY KEY (checkpoint_id, machine_id, page),
          UNIQUE(checkpoint_id, machine_id, page)
        );`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS data(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machine_id INTEGER NOT NULL,
          checkpoint_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          day INTEGER NOT NULL,
          value TEXT NOT NULL,
          shift TEXT NOT NULL,
          approved INTEGER DEFAULT 0,
          comment TEXT,
          approver_email TEXT,
          approver_name TEXT,
          batch_id INTEGER,
          page INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
          FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`
      );

      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_id ON data(batch_id);`);

      db.run(`
        CREATE TABLE IF NOT EXISTS temp_access_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          creator_id INTEGER NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1,
          FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS temp_access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          access_code_id INTEGER NOT NULL,
          real_user_id INTEGER NOT NULL,
          ip_address TEXT,
          login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (access_code_id) REFERENCES temp_access_codes(id) ON DELETE CASCADE,
          FOREIGN KEY (real_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    });
  }
});

// Handle signup form submission
app.post("/signup", (req, res) => {
  const {
    fullname,
    plant_id,
    cell_id,
    email,
    username,
    password,
    employee_id,
  } = req.body;

  if (
    !fullname ||
    !plant_id ||
    !cell_id ||
    !email ||
    !username ||
    !password ||
    !employee_id
  ) {
    return res.redirect("/error.html?type=signup&errorCode=400");
  }

  const insertUserQuery = `
    INSERT INTO users (fullname, cell_id, email, username, password, plant_id, employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    insertUserQuery,
    [fullname, cell_id, email, username, password, plant_id, employee_id],
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
  let role = null;

  if (!token) {
    return res.sendFile(path.join(__dirname, "public", "login.html"));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {

    const access_code_id = decoded.access_code_id;

    if (access_code_id) {
      const q = `
        SELECT *
        FROM temp_access_codes
        WHERE id = ?
          AND is_active = 1
          AND expires_at > datetime('now')
      `;

      return db.get(q, [access_code_id], (err, row) => {
        if (err) {
          console.error("Error checking access code:", err.message);
          return res.status(500).send("Database error occurred");
        }

        if (!row) {
          return res.sendFile(path.join(__dirname, "public", "login.html"));
        }
      });
    }

    if (err) {
      // Invalid token → show login
      return res.sendFile(path.join(__dirname, "public", "login.html"));
    }

    getUserById(decoded.id).then((user) => {
      console.log("User found:", user);
      if (!user) {
        return res.sendFile(path.join(__dirname, "public", "login.html"));
      }
      role = user.role;
      if (ADMIN_ROLES.includes(role)) {
        return res.redirect("/admin");
      }
      const plantId = decoded.plant_id;
      // Redirect to protected page with skill query
      return res.redirect(`/page1.html?plant=${plantId}`);
    });
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
// Handle login - Support both form and JSON data
app.post("/login", (req, res) => {
  const { username, password, temp_code, temp_password } = req.body;

  // 1. Authenticate Real User
  const loginQuery = `
    SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?
  `;

  db.get(loginQuery, [username, username, password], (err, realUser) => {
    if (err) {
      console.error("Login error", err.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    if (!realUser) {
      return res.status(401).json({
        success: false,
        message: "Invalid user credentials!",
      });
    }

    if (!realUser.active) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive.",
      });
    }

    // 2. Check if Temp Access Code is provided
    if (temp_code && temp_password) {
      const codeQuery = `SELECT * FROM temp_access_codes WHERE code = ? AND password = ? AND is_active = 1 AND expires_at >= datetime('now');`;
      db.get(codeQuery, [temp_code, temp_password], (err, accessCode) => {
        if (err) return res.status(500).json({ success: false, message: "Server error checking code" });

        if (!accessCode) {
          return res.status(401).json({ success: false, message: "Invalid access code or password" });
        }

        getUserById(accessCode.creator_id).then(creatorUser => {
          if (!creatorUser) return res.status(500).json({ success: false, message: "Creator user not found" });

          const logQuery = `INSERT INTO temp_access_logs (access_code_id, real_user_id, ip_address) VALUES (?, ?, ?)`;
          const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          db.run(logQuery, [accessCode.id, realUser.id, ip]);

          console.log(`User "${realUser.username}" logged in using access code "${temp_code}" (Impersonating ${creatorUser.username})`);

          const userData = {
            success: true,
            id: creatorUser.id,
            fullname: creatorUser.fullname,
            plant_id: creatorUser.plant_id,
            cell: creatorUser.cell,
            email: creatorUser.email,
            username: creatorUser.username,
            role: creatorUser.role,
            active: creatorUser.active,
            impersonated_by: realUser.id,
            access_code_id: accessCode.id, // For revocation check
            is_temp: true
          };

          console.log("Generating temp token with data:", userData);

          const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
          res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            maxAge: 24 * 60 * 60 * 1000,
          });

          return res.status(200).json(userData);
        });
      });
    } else {
      // Normal Login
      console.log(`User "${username}" logged in.`);

      const userData = {
        success: true,
        id: realUser.id,
        fullname: realUser.fullname,
        plant_id: realUser.plant_id,
        cell: realUser.cell,
        email: realUser.email,
        username: realUser.username,
        role: realUser.role,
        active: realUser.active,
      };

      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.status(200).json(userData);
    }
  });
});

app.get("/approve", verifyToken, (req, res) => {
  const { machineId, year, month, day, batchId } = req.query;
  const filePath = path.join(__dirname, "public", "approveUi.html");

  res.sendFile(filePath);
});

app.get("/me", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
       SELECT 
      u.id, 
      u.fullname, 
      c.name AS cell, 
      c.id AS cell_id,
      u.email, 
      u.role,
      u.username,
      p.id AS plant_id, 
      p.name AS plant_name,
      m.id AS machine_id,
      m.name AS machine_name,
      COALESCE(s.name, 'L0') AS skill
    FROM users u
    JOIN plants p ON u.plant_id = p.id
    JOIN machines m ON m.plant_id = p.id
    LEFT JOIN user_skills us ON us.user_id = u.id AND us.machine_id = m.id
    LEFT JOIN skills s ON us.skill_id = s.id
    LEFT JOIN cells c ON u.cell_id = c.id
    WHERE u.id = ?
    ORDER BY m.id
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).send("DB error");

    if (!rows.length) return res.status(404).send("User not found");

    const user = rows[0];

    console.log("User found:", rows);

    if (user.role === "itAdmin" || user.role === "ptt") {
      // Read HTML file
      const filePath = path.join(__dirname, "public", "profileAdmin.html");
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
        res.send(rendered);
      });
      return;
    }

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

    const access_code_id = decoded.access_code_id;

    console.log("Access code ID:", access_code_id);

    if (access_code_id) {
      const q = `
        SELECT *
        FROM temp_access_codes
        WHERE id = ?
          AND is_active = 1
          AND expires_at > datetime('now')
      `;

      return db.get(q, [access_code_id], (err, row) => {
        if (err) {
          console.error("Error checking access code:", err.message);
          return res.status(500).send("Database error occurred");
        }

        if (!row) {
          return res.redirect("/error.html?type=auth&errorCode=403&details=Invalid token");
        }

        req.user = decoded;
        const access = decoded.role === "itAdmin" ||
          decoded.role === "ptt" ||
          decoded.role === "admin";

        if (!access) return res.redirect("/error.html?type=auth&errorCode=403&details=Invalid token");

        return next();
      });
    }

    req.user = decoded;
    const access = decoded.role === "itAdmin" ||
      decoded.role === "ptt" ||
      decoded.role === "admin";

    if (!access) return res.redirect("/403.html");

    return next();
  });
}


function verifyMachineAccess(req, res, next) {
  const token = req.cookies.token;
  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );

      // first verify if admin, if admin then directly allow
      
      const access_code_id = decoded.access_code_id;

      if (access_code_id) {
        const q = `
          SELECT *
          FROM temp_access_codes
          WHERE id = ?
            AND is_active = 1
            AND expires_at > datetime('now')
        `;

        return db.get(q, [access_code_id], (err, row) => {
          if (err) {
            console.error("Error checking access code:", err.message);
            return res.status(500).send("Database error occurred");
          }

          if (!row) {
            return res.redirect("/error.html?type=auth&errorCode=403&details=Invalid token");
          }

          req.user = decoded;
          const access = decoded.role === "itAdmin" ||
            decoded.role === "ptt" ||
            decoded.role === "admin";

          if (!access) return res.redirect("/error.html?type=auth&errorCode=403&details=Invalid token");

          return next();
        });
      }

    req.user = decoded;
    req.machineId = req.params.machineId;

    const access = decoded.role === "itAdmin" ||
      decoded.role === "ptt" ||
      decoded.role === "admin";

    if (access) return next();

    const machineId = req.params.machineId;
    const userId = decoded.id;

    const query = `
      SELECT COUNT(*) AS count FROM user_skills
      WHERE user_id = ? AND machine_id = ?
    `;

    db.get(query, [userId, machineId], (err, row) => {
      if (err) {
        console.error("Error checking machine access:", err.message);
        return res.status(500).send("Database error occurred");
      }

      if (row.count === 0) {
        return res.redirect("/403.html");
      }

      next();
    });
  });
}

// Access Code Management Endpoints

