/*
 * PLC Integration Module
 * 
 * This module handles communication with PLC machines using the nodes7 library.
 * 
 * Key Features:
 * - Connects to multiple PLCs using machine-specific IP addresses and ports from the database
 * - Evaluates checkpoint results according to business rules:
 *   - Numeric: Must be within min_value and max_value range
 *   - Level: 'L'/'Low' = not OK, 'M'/'Medium'/'H'/'High' = OK
 *   - Boolean: '✗'/'Fail'/'false' = not OK, '✓'/'Pass'/'true' = OK, 'NA' = neutral
 * - Sends All_AM_Check_points_Ok signal to PLC based on overall evaluation
 * 
 * Usage:
 * - Called automatically when batch approvals are processed
 * - Can be manually triggered via /plc/putData endpoint (requires IT admin access)
 */

const nodes7 = require('nodes7');
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

// Store PLC connections per machine
const plcConnections = new Map();

const variables = {
    All_AM_Check_points_Ok: 'DB39,X0.0',
    EMG_Ok: 'DB39,X0.1',
    Door_Interlock: 'DB39,X0.2',
    HYD_Oil_Level: 'DB39,X0.3',
    Coolant_Level: 'DB39,X0.4',
};

function connectToPLC(machineId, ipAddress, port = 102) {
    return new Promise((resolve, reject) => {
        const connectionKey = `${machineId}_${ipAddress}`;
        
        if (plcConnections.has(connectionKey)) {
            const existingConn = plcConnections.get(connectionKey);
            if (existingConn.connected) {
                return resolve(existingConn);
            }
        }

        const conn = new nodes7();
        conn.setTranslationCB((tag) => variables[tag]);

        conn.initiateConnection({
            port: port,
            host: ipAddress,
            rack: 0,
            slot: 1
        }, (err) => {
            if (err) {
                console.log(`PLC connection failed for machine ${machineId} at ${ipAddress}:`, err);
                reject(err);
            } else {
                console.log(`Connected to PLC for machine ${machineId} at ${ipAddress}`);
                conn.addItems(Object.keys(variables));
                const connectionInfo = {
                    conn: conn,
                    connected: true,
                    machineId: machineId,
                    ipAddress: ipAddress
                };
                plcConnections.set(connectionKey, connectionInfo);
                resolve(connectionInfo);
            }
        });
    });
}

function evaluateCheckpoints(approvedData) {
    let allOk = true;
    const evaluationLog = [];

    for (const data of approvedData) {
        const { checkpoint, value } = data;
        let isOk = true;
        let reason = '';
        
        // For numeric checkpoints
        if (checkpoint.type === 'numeric' && checkpoint.min_value !== null && checkpoint.max_value !== null) {
            const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));
            if (isNaN(numericValue) || numericValue < checkpoint.min_value || numericValue > checkpoint.max_value) {
                isOk = false;
                reason = `Value ${numericValue} is outside range [${checkpoint.min_value}, ${checkpoint.max_value}]`;
            } else {
                reason = `Value ${numericValue} is within range [${checkpoint.min_value}, ${checkpoint.max_value}]`;
            }
        }
        // For level checkpoints
        else if (checkpoint.type === 'level') {
            if (value === 'L' || value === 'Low') {
                isOk = false;
                reason = 'Level is Low (not acceptable)';
            } else {
                reason = `Level is ${value} (acceptable)`;
            }
        }
        // For boolean/pass-fail checkpoints
        else {
            if (value === '✗' || value === 'Fail' || value === 'false') {
                isOk = false;
                reason = 'Checkpoint failed';
            } else if (value === 'NA') {
                reason = 'Checkpoint marked as Not Applicable';
            } else {
                reason = 'Checkpoint passed';
            }
        }

        evaluationLog.push({
            checkpoint: checkpoint.name,
            type: checkpoint.type,
            value: value,
            isOk: isOk,
            reason: reason
        });

        if (!isOk) {
            allOk = false;
        }
    }

    console.log('Checkpoint Evaluation Results:', evaluationLog);
    return allOk;
}

async function sendToPLC(machineId, allCheckpointsOk) {
    try {
        // Get machine details from database
        const machineQuery = `SELECT ip_address, port, name FROM machines WHERE id = ?`;
        
        return new Promise((resolve, reject) => {
            db.get(machineQuery, [machineId], async (err, machine) => {
                if (err) {
                    console.error(`Error fetching machine ${machineId}:`, err);
                    return reject(err);
                }

                if (!machine) {
                    console.error(`Machine ${machineId} not found`);
                    return reject(new Error(`Machine ${machineId} not found`));
                }

                try {
                    // Connect to PLC
                    const plcConnection = await connectToPLC(machineId, machine.ip_address, machine.port);
                    
                    // Send the All_AM_Check_points_Ok value
                    plcConnection.conn.writeItems('All_AM_Check_points_Ok', allCheckpointsOk, (writeErr) => {
                        if (writeErr) {
                            console.error(`Error writing to PLC for machine ${machine.name}:`, writeErr);
                            reject(writeErr);
                        } else {
                            console.log(`Successfully sent All_AM_Check_points_Ok = ${allCheckpointsOk} to PLC for machine ${machine.name}`);
                            resolve({ success: true, value: allCheckpointsOk });
                        }
                    });
                } catch (plcErr) {
                    console.error(`PLC connection error for machine ${machine.name}:`, plcErr);
                    reject(plcErr);
                }
            });
        });
    } catch (error) {
        console.error(`Error in sendToPLC for machine ${machineId}:`, error);
        throw error;
    }
}


module.exports = { sendToPLC, evaluateCheckpoints };
