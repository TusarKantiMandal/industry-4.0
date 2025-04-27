const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

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

module.exports = router;
