const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { sendEmail } = require("./email");
const { sendToPLC, evaluateCheckpoints } = require("./plc");
const {
  getCheckpointIdByName,
  getNextBatchId,
  getMatchineById,
  getMachineWithCellAndPlant,
  getApproverEmail,
} = require("./db");
const router = express.Router();
const db = new sqlite3.Database("./database.db");

router.get("/checkSheet", async (req, res) => {
  const user = req.user;
  const machineId = req.machineId;

  const machine = await getMatchineById(machineId);

  if (!user || !machineId) {
    return res.status(400).send("User or machine ID not provided");
  }

  // Serve the HTML file for the check sheet
  const filePath = path.join(__dirname, "public/checkSheet.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.redirect("/error.html?type=error&errorCode=500&details=Internal Server Error");
    let rendered = html.replace("{{machineName}}", machine.name || machineId);
    res.send(rendered);
    return;
  });
});

router.get("/api/checkSheet", async (req, res) => {
  const user = req.user;
  const machineId = req.machineId;
  let { year, month } = req.query;

  if (!user || !machineId) {
    return res.status(400).json({ error: "User or machine ID not provided" });
  }

  // Default to current year/month if not provided
  if (!year || !month) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  } else {
    year = parseInt(year);
    month = parseInt(month);
  }

  const machine = await getMachineWithCellAndPlant(machineId);
  if (!machine) {
    return res.status(404).json({ error: "Machine not found" });
  }

  try {
    // Get all checkpoints for this machine with page information
    const checkpoints = await getCheckPointsWithPages(machineId);

    // Get all data for this machine, year, month
    const dataQuery = `
      SELECT * FROM data
      WHERE machine_id = ? AND year = ? AND month = ? AND (
        approved = 1 OR (approved = 0 AND user_id = ?) OR (approved = -1 AND user_id = ?)
      )
    `;
    db.all(
      dataQuery,
      [machineId, year, month, req.user.id, req.user.id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }
        
        // Group checkpoints by page/checksheet
        const checkpointsByPage = {};
        checkpoints.forEach(checkpoint => {
          const page = checkpoint.page || 1;
          if (!checkpointsByPage[page]) {
            checkpointsByPage[page] = [];
          }
          checkpointsByPage[page].push(checkpoint);
        });

        const totalChecksheets = Object.keys(checkpointsByPage).length;
        
        // Return checkpoints grouped by page and data for UI rendering
        res.json({
          checkpoints,
          checkpointsByPage,
          totalChecksheets,
          data: rows,
          machine: machine,
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

function getCheckPoints(machineId) {
  query = `SELECT c.* FROM checkpoints c
    JOIN machine_checkpoint mc ON c.id = mc.checkpoint_id
    WHERE mc.machine_id = ?`;
  return new Promise((resolve, reject) => {
    db.all(query, [machineId], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

function getCheckPointsWithPages(machineId) {
  query = `SELECT c.*, mc.page FROM checkpoints c
    JOIN machine_checkpoint mc ON c.id = mc.checkpoint_id
    WHERE mc.machine_id = ?
    ORDER BY mc.page, c.id`;
  return new Promise((resolve, reject) => {
    db.all(query, [machineId], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

router.put("/updateData", async (req, res) => {
  const { machineId, approverEmail, approverName, data } = req.body;
  const userId = req.user?.id;

  console.log("Received updateData request:", req.body);

  if (!userId) return res.status(401).json({ error: "User not authenticated" });
  if (!machineId || !approverEmail || !approverName || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let batchId;
  try {
    batchId = await getNextBatchId();
  } catch (err) {
    console.error("Error fetching batch ID:", err);
    return res.status(500).json({ error: "Error generating batch ID" });
  }

  const dbOps = [];

  for (const item of data) {
    const { year, month, day, shift, value, checkpoint, page } = item;

    if (!year || !month || !day || !shift || !value || !checkpoint) {
      return res
        .status(400)
        .json({ error: `Missing fields in data item: ${checkpoint}` });
    }

    // const checkpointId = await getCheckpointIdByName(checkpoint);
    // if (!checkpointId) {
    //   return res
    //     .status(400)
    //     .json({ error: `Invalid checkpoint name: ${checkpoint}` });
    // }

    const result = await new Promise((resolve, reject) => {
      const selectQuery = `
        SELECT id, approved FROM data 
        WHERE machine_id = ? AND year = ? AND month = ? AND day = ? AND shift = ? AND checkpoint_id = ?
      `;
      db.get(
        selectQuery,
        [machineId, year, month, day, shift, checkpoint],
        function (err, row) {
          if (err) return reject(new Error("Database error on SELECT"));
          if (row && row.approved === 1) {
            return reject(
              new Error(
                `Checkpoint "${checkpoint}" already approved. Cannot update.`
              )
            );
          }

          if (row) {
            const updateQuery = `
              UPDATE data
              SET value = ?, approver_email = ?, approver_name = ?, user_id = ?, batch_id = ?, page = ?, updated_at = CURRENT_TIMESTAMP, approved = 0
              WHERE machine_id = ? AND year = ? AND month = ? AND day = ? AND shift = ? AND checkpoint_id = ?
            `;
            dbOps.push({
              query: updateQuery,
              params: [
                value,
                approverEmail,
                approverName,
                userId,
                batchId,
                page || 1, // Default to page 1 if not provided
                machineId,
                year,
                month,
                day,
                shift,
                checkpoint,
              ],
            });
            resolve();
          } else {
            const insertQuery = `
              INSERT INTO data (machine_id, year, month, day, shift, value, approver_email, approver_name, checkpoint_id, user_id, batch_id, page)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            dbOps.push({
              query: insertQuery,
              params: [
                machineId,
                year,
                month,
                day,
                shift,
                value,
                approverEmail,
                approverName,
                checkpoint,
                userId,
                batchId,
                page || 1, // Default to page 1 if not provided
              ],
            });
            resolve();
          }
        }
      );
    }).catch((err) => {
      return res.status(400).json({ error: err.message });
    });
  }

  for (const op of dbOps) {
    const result = await new Promise((resolve, reject) => {
      db.run(op.query, op.params, function (err) {
        if (err)
          return reject(new Error("Database error during insert/update"));
        resolve(this.lastID);
      });
    }).catch((err) => {
      return res.status(500).json({ error: err.message });
    });
  }

  // All successful
  sendApprovalEmail(data[0], machineId, approverEmail, approverName, batchId);
  return res.json({ success: true, batchId });

  async function sendApprovalEmail(
    firstItem,
    machineId,
    approverEmail,
    approverName,
    batchId
  ) {
    const { year, month, day } = firstItem;

    const machineName = (await getMatchineById(machineId)) || {
      name: machineId,
    };

    console.log("machine ", machineName);

    const approveLink = `${
      process.env.APPROVE_BASE_URL || "http://localhost:3000"
    }/approve?machineId=${encodeURIComponent(
      machineId
    )}&year=${encodeURIComponent(year)}&month=${encodeURIComponent(
      month
    )}&day=${encodeURIComponent(day)}&batchId=${encodeURIComponent(batchId)}`;

    sendEmail({
      to: approverEmail,
      cc: [],
      subject: "CheckSheet Data Updated - Review Required",
      body: `Hello ${approverName},<br><br>
        The check sheet data for Machine: ${machineName.name}, Date: ${year}-${month}-${day}, BatchId: ${batchId} has been updated by ${req.user.fullname}.<br><br>
        Please <a href='${approveLink}'>click here to review and approve</a>.<br><br>
        Regards,<br>
        CheckSheet System`,
    }).catch((error) => {
      console.error("Error sending email:", error);
    });
  }
});

// router.post("/approve", async (req, res) => {
//   const { machineId, year, month, day, shift, id } = req.body;

//   const query = `
//     SELECT approver_email FROM data
//     WHERE id = ? AND machine_id = ? AND year = ? AND month = ? AND day = ? AND shift = ?
//   `;
  
//   try {
//     const row = await new Promise((resolve, reject) => {
//       db.get(query, [id, machineId, year, month, day, shift], (err, row) => {
//         if (err) reject(err);
//         else resolve(row);
//       });
//     });

//     const approverEmail = row ? row.approver_email : null;

//     if (req.user.email != approverEmail) {
//       return res
//         .status(403)
//         .send("You are not authorized to approve this data");
//     }

//     if (!machineId || !year || !month || !day || !shift || !id) {
//       return res.status(400).send("Missing required parameters");
//     }

//     // Get checkpoint details for this specific approval
//     const checkpointQuery = `
//       SELECT d.*, c.type, c.min_value, c.max_value, c.name as checkpoint_name
//       FROM data d
//       JOIN checkpoints c ON d.checkpoint_id = c.id
//       WHERE d.id = ?
//     `;

//     const checkpointData = await new Promise((resolve, reject) => {
//       db.get(checkpointQuery, [id], (err, row) => {
//         if (err) reject(err);
//         else resolve(row);
//       });
//     });

//     // Update the data row to mark it as approved
//     const updateQuery = `
//       UPDATE data
//       SET approved = 1
//       WHERE id = ? AND machine_id = ? AND year = ? AND month = ? AND day = ? AND shift = ?
//     `;
    
//     await new Promise((resolve, reject) => {
//       db.run(updateQuery, [id, machineId, year, month, day, shift], function (err) {
//         if (err) reject(err);
//         else resolve(this);
//       });
//     });

//     // For individual approvals, we need to check if this affects the overall machine status
//     // Get all approved checkpoints for this machine on this date/shift
//     const allCheckpointsQuery = `
//       SELECT d.*, c.type, c.min_value, c.max_value, c.name as checkpoint_name
//       FROM data d
//       JOIN checkpoints c ON d.checkpoint_id = c.id
//       WHERE d.machine_id = ? AND d.year = ? AND d.month = ? AND d.day = ? AND d.shift = ? AND d.approved = 1
//     `;

//     const allApprovedData = await new Promise((resolve, reject) => {
//       db.all(allCheckpointsQuery, [machineId, year, month, day, shift], (err, rows) => {
//         if (err) reject(err);
//         else resolve(rows);
//       });
//     });

//     if (allApprovedData.length > 0) {
//       // Evaluate all approved checkpoints
//       const checkpointsWithDetails = allApprovedData.map(data => ({
//         checkpoint: {
//           type: data.type,
//           min_value: data.min_value,
//           max_value: data.max_value,
//           name: data.checkpoint_name
//         },
//         value: data.value
//       }));

//       const allCheckpointsOk = evaluateCheckpoints(checkpointsWithDetails);
      
//       console.log(`Individual approval for machine ${machineId}: All checkpoints OK = ${allCheckpointsOk}`);
      
//       try {
//         // Send result to PLC
//         await sendToPLC(machineId, allCheckpointsOk);
//         res.send("Data approved successfully and sent to PLC");
//       } catch (plcError) {
//         console.error("Error sending data to PLC:", plcError);
//         res.send("Data approved successfully, but PLC communication failed");
//       }
//     } else {
//       res.send("Data approved successfully");
//     }
    
//   } catch (error) {
//     console.error("Error in individual approval:", error);
//     res.status(500).send("Database error");
//   }
// });

router.get("/batchData/:batchId", (req, res) => {
  const batchId = req.params.batchId;

  if (!batchId) {
    return res.status(400).send("Batch ID not provided");
  }

  const query = `
    SELECT d.*, m.name AS machine_name, c.name AS checkpoint_name, user.fullname AS user_name, user.email AS user_email
    FROM data d
    JOIN machines m ON d.machine_id = m.id
    JOIN checkpoints c ON d.checkpoint_id = c.id
    JOIN users user ON d.user_id = user.id
    WHERE d.batch_id = ? AND d.approved = 0
  `;

  db.all(query, [batchId], (err, rows) => {
    if (err) {
      return res.status(500).send("Database error");
    }

    console.log("Fetched rows for batch:", rows);

    if (rows.length != 0 && rows[0].approver_email != req.user.email) {
      return res.status(403).send("You are not authorized to view this batch");
    }

    res.json(rows);
  });
});

router.post("/batchData/:batchId/approve", async (req, res) => {
  const batchId = req.params.batchId;

  if (!batchId) {
    return res.status(400).send("Batch ID not provided");
  }

  const email = req.user.email;
  if (!email) {
    return res.status(401).send("User not authenticated");
  }
  // Check if the user is authorized to approve this batch

  const approverEmail = await getApproverEmail(batchId);

  console.log("Approver email for batch:", approverEmail);
  console.log("User email:", email);

  if (approverEmail !== email) {
    return res.status(403).send("You are not authorized to approve this batch");
  }

  try {
    // Get all data for this batch with checkpoint details before approval
    const batchDataQuery = `
      SELECT d.*, c.type, c.min_value, c.max_value, c.name as checkpoint_name
      FROM data d
      JOIN checkpoints c ON d.checkpoint_id = c.id
      WHERE d.batch_id = ? AND d.approver_email = ?
    `;

    const batchData = await new Promise((resolve, reject) => {
      db.all(batchDataQuery, [batchId, email], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (batchData.length === 0) {
      return res.status(404).send("No data found for this batch");
    }

    const machineId = batchData[0].machine_id;

    // Approve the batch
    const updateQuery = `
      UPDATE data
      SET approved = 1, updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = ? AND approver_email = ?
    `;

    await new Promise((resolve, reject) => {
      db.run(updateQuery, [batchId, email], function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

    // Evaluate checkpoints according to the business rules
    const checkpointsWithDetails = batchData.map(data => ({
      checkpoint: {
        type: data.type,
        min_value: data.min_value,
        max_value: data.max_value,
        name: data.checkpoint_name,
        page: data.page
      },
      value: data.value
    }));

    const allCheckpointsOk = evaluateCheckpoints(checkpointsWithDetails);
    
    console.log(`Batch ${batchId} approval result: All checkpoints OK = ${allCheckpointsOk}`);
    
    try {
      await sendToPLC(machineId, allCheckpointsOk);
      res.send("Batch approved successfully and sent to PLC");
    } catch (plcError) {
      console.error("Error sending data to PLC:", plcError);
      res.send("Batch approved successfully, but PLC communication failed");
    }
    
    sendBatchOwnerNotification(batchId, "approved");
    
  } catch (error) {
    console.error("Error in batch approval:", error);
    res.status(500).send("Database error");
  }
});

router.post("/batchData/:batchId/reject", async (req, res) => {
  const batchId = req.params.batchId;

  if (!batchId) {
    return res.status(400).send("Batch ID not provided");
  }

  const email = req.user.email;
  if (!email) {
    return res.status(401).send("User not authenticated");
  }
  // Check if the user is authorized to approve this batch

  const approverEmail = await getApproverEmail(batchId);

  console.log("Approver email for batch:", approverEmail);
  console.log("User email:", email);

  if (approverEmail !== email) {
    return res.status(403).send("You are not authorized to approve this batch");
  }

  const query = `
    UPDATE data
    SET approved = -1, updated_at = CURRENT_TIMESTAMP
    WHERE batch_id = ? AND approver_email = ?
  `;

  db.run(query, [batchId, email], function (err) {
    if (err) {
      return res.status(500).send("Database error");
    }
    res.send("Batch rejected successfully");
    sendBatchOwnerNotification(batchId, "rejected");
  });
});

function sendBatchOwnerNotification(batchId, status) {
  // Find the owner (user who submitted the batch)
  const ownerQuery = `SELECT user_id, machine_id, year, month, day, shift FROM data WHERE batch_id = ? LIMIT 1`;
  db.get(ownerQuery, [batchId], (err, row) => {
    if (err || !row || !row.user_id) return;
    const userQuery = `SELECT email, fullname FROM users WHERE id = ?`;
    db.get(userQuery, [row.user_id], async (err2, userRow) => {
      if (err2 || !userRow) return;
      const machineName = (await getMatchineById(row.machine_id)) || {
        name: row.machine_id,
      };

      const url = `${
        process.env.APPROVE_BASE_URL || "http://localhost:3000"
      }/machine/${row.machine_id}/checkSheet?year=${row.year}&month=${
        row.month
      }`;
      sendEmail({
        to: userRow.email,
        cc: [],
        subject: `CheckSheet Entry ${
          status === "approved" ? "Approved" : "Rejected"
        }`,
        body: `Hello ${userRow.fullname},<br><br>Your submitted check sheet entry for Machine: ${machineName.name}, Date: ${row.year}-${row.month}-${row.day}, Shift: ${row.shift} has been <b>${status}</b>.<br><br>View the check sheet: <a href='${url}'>Check Sheet</a><br><br>Regards,<br>CheckSheet System`,
      }).catch((error) => {
        console.error("Error sending batch owner notification email:", error);
      });
    });
  });
}

module.exports = router;
