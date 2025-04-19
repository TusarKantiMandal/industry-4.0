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

  const userQuery = `
  SELECT 
    u.id, 
    u.fullname, 
    u.email, 
    u.username,
    u.role,
    u.active,
    p.id AS plant_id, 
    p.name AS plant_name,
    c.id AS cell_id,
    c.name AS cell
  FROM users u
  LEFT JOIN plants p ON u.plant_id = p.id
  LEFT JOIN cells c ON u.cell_id = c.id
  WHERE u.id = ?
`;


  const skillsQuery = `
    SELECT 
      us.machine_id,
      m.name AS machine_name,
      s.name AS skill
    FROM user_skills us
    JOIN machines m ON us.machine_id = m.id
    JOIN skills s ON us.skill_id = s.id
    WHERE us.user_id = ?
  `;

  const plantsQuery = `SELECT id, name FROM plants ORDER BY name ASC`;
  const cellsQuery = `SELECT id, name, plant_id FROM cells ORDER BY name ASC`;

  const data = {
    user: null,
    plants: [],
    cells: [],
    machines: []
  };

  db.get(userQuery, [userId], (err, user) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    data.user = user;

    db.all(skillsQuery, [userId], (err, skills) => {
      if (err) {
        console.error("Error retrieving skills:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      data.user.skills = skills || [];

      db.all(plantsQuery, [], (err, plants) => {
        if (err) {
          console.error("Error retrieving plants:", err.message);
          return res.status(500).json({ error: "Database error occurred" });
        }

        data.plants = plants;

        db.all(cellsQuery, [], (err, cells) => {
          if (err) {
            console.error("Error retrieving cells:", err.message);
            return res.status(500).json({ error: "Database error occurred" });
          }

          data.cells = cells;

          const machinesQuery = `
            SELECT id, name, cell_id, plant_id 
            FROM machines 
            WHERE plant_id = ? AND cell_id = ?
          `;

          db.all(machinesQuery, [user.plant_id, user.cell_id], (err, machines) => {
            if (err) {
              console.error("Error retrieving machines:", err.message);
              return res.status(500).json({ error: "Database error occurred" });
            }

            data.machines = machines || [];

            res.json(data);
          });
        });
      });
    });
  });
});

// Update user
router.put("/users/:id", (req, res) => {
  const userId = req.params.id;
  const { fullname, email, cell, skills } = req.body;

  console.log(req.body);

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

    db.run(updateUserQuery, [fullname, email, cell, userId], function (err) {
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
          INSERT INTO user_skills (user_id, machine_id, skill_id)
          SELECT
              ?, m.id, SELECT s.name FROM skills s WHERE s.name = ?
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
          return res.status(200).json({ message: "User updated successfully" });
        }
      );
    });
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
          return res
            .status(500)
            .json({ error: "Failed to update user's plant" });
        }

        return res
          .status(200)
          .json({ message: "Plant updated and skills removed successfully" });
      });
    });
  });
});

// change cell for a user
router.put("/users/:id/cell", (req, res) => {
  const userId = req.params.id;
  const { cellId } = req.body;

  if (!cellId) {
    return res.status(400).json({ error: "Cell ID is required" });
  }

  db.get("SELECT id FROM cells WHERE id = ?", [cellId], (err, row) => {
    if (err) {
      console.error("Error checking cell ID:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!row) {
      return res.status(400).json({ error: "Invalid cell ID" });
    }

    const deleteQuery = `
      DELETE FROM user_skills 
      WHERE user_id = ? 
      AND machine_id NOT IN (
        SELECT id FROM machines WHERE cell_id = ?
      )
    `;

    db.run(deleteQuery, [userId, cellId], function (err) {
      if (err) {
        console.error("Error deleting user skills:", err.message);
        return res.status(500).json({ error: "Failed to update user skills" });
      }

      const updateUserQuery = `UPDATE users SET cell_id = ? WHERE id = ?`;

      db.run(updateUserQuery, [cellId, userId], function (err) {
        if (err) {
          console.error("Error updating user's cell:", err.message);
          return res
            .status(500)
            .json({ error: "Failed to update user's Cell" });
        }

        return res
          .status(200)
          .json({ message: "Cell updated and skills removed successfully" });
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

// API routes for plants
router.post("/plants", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Plant name is required" });
  }

  const query = `INSERT INTO plants (name) VALUES (?)`;

  db.run(query, [name], function (err) {
    if (err) {
      console.error("Error creating plant:", err.message);
      return res.status(500).json({ error: "Failed to create plant" });
    }

    res.status(201).json({
      id: this.lastID,
      name,
      message: "Plant created successfully",
    });
  });
});

router.put("/plants/:id", (req, res) => {
  const plantId = req.params.id;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Plant name is required" });
  }

  const query = `UPDATE plants SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  db.run(query, [name, plantId], function (err) {
    if (err) {
      console.error("Error updating plant:", err.message);
      return res.status(500).json({ error: "Failed to update plant" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Plant not found" });
    }

    res.json({
      id: plantId,
      name,
      message: "Plant updated successfully",
    });
  });
});

router.delete("/plants/:id", (req, res) => {
  const plantId = req.params.id;

  db.run("DELETE FROM plants WHERE id = ?", [plantId], function (err) {
    if (err) {
      console.error("Error deleting plant:", err.message);
      return res.status(500).json({ error: "Failed to delete plant" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Plant not found" });
    }

    res.json({ message: "Plant and all related data deleted successfully." });
  });
});

// API routes for machines
router.post("/machines", (req, res) => {
  const { name, minimum_skill, plant_id, cell_id } = req.body;

  if (!name || !plant_id || !cell_id) {
    return res
      .status(400)
      .json({ error: "Machine name, plant ID, and cell ID are required" });
  }

  // Validate plant exists
  db.get("SELECT id FROM plants WHERE id = ?", [plant_id], (err, plant) => {
    if (err) {
      console.error("Error checking plant:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!plant) {
      return res.status(400).json({ error: "Invalid plant ID" });
    }

    // Validate cell exists
    db.get("SELECT id FROM cells WHERE id = ?", [cell_id], (err, cell) => {
      if (err) {
        console.error("Error checking cell:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      if (!cell) {
        return res.status(400).json({ error: "Invalid cell ID" });
      }

      const query = `INSERT INTO machines (name, minimum_skill, plant_id, cell_id) VALUES (?, ?, ?, ?)`;
      const skill = minimum_skill || 1;

      db.run(query, [name, skill, plant_id, cell_id], function (err) {
        if (err) {
          console.error("Error creating machine:", err.message);
          return res.status(500).json({ error: "Failed to create machine" });
        }

        res.status(201).json({
          id: this.lastID,
          name,
          minimum_skill: skill,
          plant_id,
          cell_id,
          message: "Machine created successfully",
        });
      });
    });
  });
});

router.delete("/machines/:id", (req, res) => {
  const machineId = req.params.id;

  db.run("DELETE FROM machines WHERE id = ?", [machineId], function (err) {
    if (err) {
      console.error("Error deleting machine:", err.message);
      return res.status(500).json({ error: "Failed to delete machine" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Machine not found" });
    }

    res.json({ message: "Machine and related user skills deleted successfully." });
  });
});


router.delete("/machines/:id", (req, res) => {
  const machineId = req.params.id;

  // Check if the machine is associated with any user skills
  db.get(
    "SELECT COUNT(*) as count FROM user_skills WHERE machine_id = ?",
    [machineId],
    (err, result) => {
      if (err) {
        console.error("Error checking machine usage:", err.message);
        return res.status(500).json({ error: "Database error occurred" });
      }

      if (result.count > 0) {
        return res.status(400).json({
          error: "Cannot delete machine because it has associated user skills",
        });
      }

      // If no associations, delete the machine
      db.run("DELETE FROM machines WHERE id = ?", [machineId], function (err) {
        if (err) {
          console.error("Error deleting machine:", err.message);
          return res.status(500).json({ error: "Failed to delete machine" });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Machine not found" });
        }

        res.json({ message: "Machine deleted successfully" });
      });
    }
  );
});

// API routes for cells
router.post("/cells", (req, res) => {
  const { cellName, plant_id } = req.body;

  if (!cellName || !plant_id) {
    return res
      .status(400)
      .json({ error: "Cell name and plant ID are required" });
  }

  const query = `INSERT INTO cells (name , plant_id) VALUES (?, ?)`;

  // Validate plant exists
  db.get("SELECT id FROM plants WHERE id = ?", [plant_id], (err, plant) => {
    if (err) {
      console.error("Error checking plant:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!plant) {
      return res.status(400).json({ error: "Invalid plant ID" });
    }
    db.run(query, [cellName, plant_id], function (err) {
      if (err) {
        console.error("Error creating cell:", err.message);
        return res.status(500).json({ error: "Failed to create cell" });
      }

      res.status(201).json({
        id: this.lastID,
        name: cellName,
        plant_id,
        message: "Cell created successfully",
      });
    });
  });
});
router.put("/cells/:id", (req, res) => {
  const cellId = req.params.id;
  const { cellName, plant_id } = req.body;

  if (!cellName || !plant_id) {
    return res
      .status(400)
      .json({ error: "Cell name and plant ID are required" });
  }

  const query = `UPDATE cells SET name = ?, plant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

  // Validate plant exists
  db.get("SELECT id FROM plants WHERE id = ?", [plant_id], (err, plant) => {
    if (err) {
      console.error("Error checking plant:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    if (!plant) {
      return res.status(400).json({ error: "Invalid plant ID" });
    }

    db.run(query, [cellName, plant_id, cellId], function (err) {
      if (err) {
        console.error("Error updating cell:", err.message);
        return res.status(500).json({ error: "Failed to update cell" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Cell not found" });
      }

      res.json({
        id: cellId,
        name: cellName,
        plant_id,
        message: "Cell updated successfully",
      });
    });
  });
});

router.delete("/cells/:id", (req, res) => {
  const cellId = req.params.id;

  db.run("DELETE FROM cells WHERE id = ?", [cellId], function (err) {
    if (err) {
      console.error("Error deleting cell:", err.message);
      return res.status(500).json({ error: "Failed to delete cell" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Cell not found" });
    }

    res.json({ message: "Cell and all related machines and user skills deleted successfully." });
  });
});


module.exports = router;
