const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database('./database.db');

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
        message: `User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
        newStatus
      });
    });
  });
});

module.exports = router;
