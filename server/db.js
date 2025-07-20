const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { Router } = require("express");
const router = Router();
const db = new sqlite3.Database("./database.db");

function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getCheckpointIdByName(checkpointName) {
    return new Promise((resolve, reject) => {
        db.get("SELECT id FROM checkpoints WHERE name = ?", [checkpointName], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.id : null);
            }
        });
    });
}

function getNextBatchId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(batch_id) as lastBatch FROM data`, [], (err, row) => {
      if (err) return reject(err);
      resolve((row?.lastBatch || 0) + 1);
    });
  });
}

function getMatchineById(machineId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM machines WHERE id = ?", [machineId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getMachineWithCellAndPlant(machineId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT machines.*, cells.name AS cell_name, plants.name AS plant_name
             FROM machines
             LEFT JOIN cells ON machines.cell_id = cells.id
             LEFT JOIN plants ON machines.plant_id = plants.id
             WHERE machines.id = ?`,
            [machineId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
}

function getApproverEmail(batchId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT approver_email FROM data WHERE batch_id = ? LIMIT 1", [batchId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.approver_email : null);
            }
        });
    });
}

module.exports = { getUserById, getCheckpointIdByName, getNextBatchId, getMatchineById, getMachineWithCellAndPlant, getApproverEmail };
