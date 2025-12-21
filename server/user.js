const express = require("express");
const path = require("path");
const fs = require("fs");
const { route } = require("./api");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();
const db = new sqlite3.Database("./database.db");

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "some_secret";

