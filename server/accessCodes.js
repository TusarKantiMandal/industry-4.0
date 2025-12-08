const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

// Create Access Code
router.post("/", (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'ptt') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    let { code, password, duration_hours } = req.body;
    const creator_id = req.user.id;

    // Auto-generate if missing
    if (!code) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    if (!password) {
        password = Math.random().toString(36).substring(2, 8);
    }

    const expires_at = new Date(Date.now() + (duration_hours || 24) * 60 * 60 * 1000).toISOString();

    console.log(`Creating access code: ${code} for user ${creator_id}, expires: ${expires_at}`);

    const query = `INSERT INTO temp_access_codes (code, password, creator_id, expires_at) VALUES (?, ?, ?, ?)`;

    db.run(query, [code, password, creator_id, expires_at], function (err) {
        if (err) {
            console.error("Error creating access code:", err.message);
            return res.status(500).json({ error: "Database error: " + err.message });
        }
        console.log("Access code created with ID:", this.lastID);
        res.json({ success: true, id: this.lastID, code, password, expires_at });
    });
});

// List Access Codes
router.get("/", (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'ptt') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const query = `
    SELECT * FROM temp_access_codes 
    WHERE creator_id = ?
    ORDER BY created_at DESC
  `;

    db.all(query, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Delete/Deactivate Access Code
router.delete("/:id", (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'ptt') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const query = `UPDATE temp_access_codes SET is_active = 0 WHERE id = ? AND creator_id = ?`;

    db.run(query, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: "Database error" });
        if (this.changes === 0) return res.status(404).json({ error: "Code not found or unauthorized" });
        res.json({ success: true });
    });
});

// Get Logs for Access Code
router.get("/:id/logs", (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'ptt') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    // Ensure user owns the code
    const checkQuery = `SELECT id FROM temp_access_codes WHERE id = ? AND creator_id = ?`;
    db.get(checkQuery, [req.params.id, req.user.id], (err, code) => {
        if (err || !code) return res.status(404).json({ error: "Code not found or unauthorized" });

        const logQuery = `
      SELECT l.*, u.fullname, u.email 
      FROM temp_access_logs l
      JOIN users u ON l.real_user_id = u.id
      WHERE l.access_code_id = ?
      ORDER BY l.login_time DESC
    `;

        db.all(logQuery, [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json(rows);
        });
    });
});

module.exports = router;
