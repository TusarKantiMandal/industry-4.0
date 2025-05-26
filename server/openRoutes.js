const express = require("express");
const path = require("path");
const fs = require("fs");
const { route } = require("./api");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

const jwt = require("jsonwebtoken");
const JWT_SECRET = "SECRET_KEY"; // TODO: get from .env

router.get("/cells", (req, res) => {
  const query =
    "SELECT p.id as plant_id, p.name as plant_name, c.id as cell_id, c.name as cell_name FROM cells c JOIN plants p ON c.plant_id = p.id";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error retrieving cells:", err.message);
      return res.status(500).json({ error: "Database error occurred" });
    }

    const formattedRows = rows.map((row) => ({
      plant_id: row.plant_id,
      plant_name: row.plant_name,
      cell_id: row.cell_id,
      cell_name: row.cell_name,
    }));

    res.json(formattedRows);
  });
});

router.get("/me", (req, res) => {
  // Simulate user data retrieval
  const token = req.cookies.token;
  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );
    req.user = decoded;

    const userId = decoded.id;

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
      machines: [],
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

            db.all(
              machinesQuery,
              [user.plant_id, user.cell_id],
              (err, machines) => {
                if (err) {
                  console.error("Error retrieving machines:", err.message);
                  return res
                    .status(500)
                    .json({ error: "Database error occurred" });
                }

                data.machines = machines || [];

                res.json(data);
              }
            );
          });
        });
      });
    });
  });
});

module.exports = router;
