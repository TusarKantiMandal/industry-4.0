const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

router.get("/", (req, res) => {
  res.json(`hello ${req.user.fullname}`);
});

router.put("/users/:id/status", (req, res) => {
  const userId = req.params.id;

  const getCurrentStatus = "SELECT active FROM users WHERE id = ?";
  const updateStatus = "UPDATE users SET active = ? WHERE id = ?";

  db.get(getCurrentStatus, [userId], (err, row) => {
    if (err) {
      console.error("Error fetching user status:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }

    const newStatus = row.active === 1 ? 0 : 1;

    db.run(updateStatus, [newStatus, userId], function (err) {
      if (err) {
        console.error("Error updating user status:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      res.json({
        success: true,
        message: `User ${
          newStatus === 1 ? "activated" : "deactivated"
        } successfully`,
        newStatus,
      });
    });
  });
});

// Get user by ID
router.get("/users/:id", (req, res) => {
  const userId = req.params.id;

  // Query to get user data
  const userQuery = `
     SELECT 
    u.id, 
    u.fullname, 
    u.cell, 
    u.email, 
    u.username,
    u.role,
    u.active,
    p.id AS plant_id, 
    p.name AS plant_name
  FROM users u
  JOIN plants p ON u.plant_id = p.id
  WHERE u.id = ?
  `;

  // Query to get user skills
  const skillsQuery = `
 SELECT 
  us.machine_id,
  m.name AS machine_name,
  us.skill
FROM user_skills us
JOIN machines m ON us.machine_id = m.id
WHERE us.user_id = ?;

  `;

  db.get(userQuery, [userId], (err, user) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user skills
    db.all(skillsQuery, [userId], (err, skills) => {
      if (err) {
        console.error("Error retrieving skills:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      // Add skills to user object
      user.skills = skills || [];

      res.json(user);
    });
  });
});

// Update user
router.put("/users/:id", (req, res) => {
  const userId = req.params.id;
  const { fullname, email, cell, skills } = req.body;

  console.log(req.body)

  if (!fullname || !email || !cell || !skills) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!Array.isArray(skills)) {
    return res.status(400).json({ error: "Skills must be an array" });
  }

  for (const skill of skills) {
    if (!skill.name || !skill.level) {
      return res
        .status(400)
        .json({ error: "Skill name and level are required" });
    }
  }

  db.get("SELECT id FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) {
      console.error("Error checking user ID:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }
  });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const updateUserQuery = `
      UPDATE users
      SET 
        fullname = ?,
        email = ?,
        cell = ?
      WHERE id = ?
    `;

    db.run(
      updateUserQuery,
      [fullname, email, cell, userId],
      function (err) {
        if (err) {
          console.error("Error updating user:", err.message);
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Failed to update user" });
        }

        // Delete existing skills
        db.run(
          "DELETE FROM user_skills WHERE user_id = ?",
          [userId],
          function (err) {
            if (err) {
              console.error("Error deleting skills:", err.message);
              db.run("ROLLBACK");
              return res.status(500).json({ error: "Failed to update skills" });
            }

            // Insert new skills
            const insertSkillStmt = db.prepare(`
          INSERT INTO user_skills (user_id, machine_id, skill)
          SELECT
              ?, m.id, ?
          FROM machines m
          JOIN users u ON u.id = ?
          WHERE m.name = ?
              AND m.plant_id = u.plant_id
        `);

            let skillError = false;

            if (skills && skills.length > 0) {
              skills.forEach((skill) => {
                insertSkillStmt.run(
                  userId,
                  skill.level,
                  userId,
                  skill.name,
                  function (err) {
                    if (err) {
                      skillError = true;
                    }
                  }
                );
              });
            }

            insertSkillStmt.finalize();

            if (skillError) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: "Failed to update skills" });
            }

            db.run("COMMIT");
            return res
              .status(200)
              .json({ message: "User updated successfully" });
          }
        );
      }
    );
  });
});

// Reset user password
router.post("/users/:id/reset-password", (req, res) => {
  const userId = req.params.id;

  // Generate a random password
  const tempPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = hashPassword(tempPassword); // You'll need a password hashing function

  // Update user's password in database
  const updateQuery = `
    UPDATE users
    SET password = ?
    WHERE id = ?
  `;

  db.run(updateQuery, [hashedPassword, userId], function (err) {
    if (err) {
      console.error("Error resetting password:", err.message);
      return res.status(500).json({ error: "Failed to reset password" });
    }

    // In a real application, you would send an email with the temp password
    console.log(
      `Password reset for user ${userId}. Temporary password: ${tempPassword}`
    );

    res.status(200).json({ message: "Password reset successful" });
  });
});

// change plant for a user
router.put("/users/:id/plant", (req, res) => {
  const userId = req.params.id;
  const { plantId } = req.body;

  if (!plantId) {
    return res.status(400).json({ error: "Plant ID is required" });
  }

  db.get("SELECT id FROM plants WHERE id = ?", [plantId], (err, row) => {
    if (err) {
      console.error("Error checking plant ID:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!row) {
      return res.status(400).json({ error: "Invalid plant ID" });
    }

    const deleteQuery = `
      DELETE FROM user_skills 
      WHERE user_id = ? 
      AND machine_id NOT IN (
        SELECT id FROM machines WHERE plant_id = ?
      )
    `;

    db.run(deleteQuery, [userId, plantId], function (err) {
      if (err) {
        console.error("Error deleting user skills:", err.message);
        return res.status(500).json({ error: "Failed to update user skills" });
      }

      const updateUserQuery = `UPDATE users SET plant_id = ? WHERE id = ?`;

      db.run(updateUserQuery, [plantId, userId], function (err) {
        if (err) {
          console.error("Error updating user's plant:", err.message);
          return res.status(500).json({ error: "Failed to update user's plant" });
        }

        return res.status(200).json({ message: "Plant updated and skills removed successfully" });
      });
    });
  });
});

// Simple password hashing function (use bcrypt in production)
function hashPassword(password) {
  // In a real application, use a proper password hashing library like bcrypt
  return password; // This is just a placeholder
}

// Get all plants
router.get("/plants", (req, res) => {
  const query = "SELECT * FROM plants";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error retrieving plants:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    res.json(rows);
  });
});
// Get all machines
router.get("/machines", (req, res) => {
  const query = "SELECT * FROM machines";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error retrieving machines:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    res.json(rows);
  });
});

// Get Machine by plant ID
router.get("/plants/:id/machines", (req, res) => {
  const plantId = req.params.id;

  const query = `
    SELECT m.id, m.name
    FROM machines m
    JOIN plants p ON m.plant_id = p.id
    WHERE p.id = ?
  `;

  db.all(query, [plantId], (err, rows) => {
    if (err) {
      console.error("Error retrieving machines:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }
    res.json(rows);
  });
});

module.exports = router;
