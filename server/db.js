import express from "express";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { Router } from "express";
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

export { getUserById };
