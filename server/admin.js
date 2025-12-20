const express = require("express");
const router = express.Router();
const path = require("path");

const itRoutes = require("./it");
const pttRoutes = require("./ptt");
router.use("/it", verifyItAdmin, itRoutes);
router.use("/ptt", pttRoutes);
const jwt = require("jsonwebtoken");

const JWT_SECRET = "SECRET_KEY";

function verifyItAdmin(req, res, next) {
  const token = req.cookies.token;
  if (!token)
    return res.redirect("/error.html?type=auth&errorCode=401&details=No token");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.redirect(
        "/error.html?type=auth&errorCode=403&details=Invalid token"
      );
    req.user = decoded;
    if (decoded.role != "itAdmin") return res.redirect("/403.html");
    next();
  });
}


router.get("/", (req, res) => {
  if (req.user.role == "itAdmin") return res.redirect("/admin/it");
  if (req.user.role == "ptt" || req.user.role == "admin") return res.redirect("/admin/ptt");
  // if (req.user.role == "admin") {
  //   return res.send(`
  //     <h1>Welcome to the admin panel</h1>
  //     <p>Click <a href="/admin/it">here</a> to go to the IT admin panel</p>
  //     <p>Click <a href="/admin/ptt">here</a> to go to the PTT admin panel</p>
  //   `);
  // }
  return res.redirect("/error.html?type=auth&errorCode=403&details=Unauthorized");
});


router.get("/access-codes", (req, res) => {
  const access_code_id = req.user.access_code_id;
  if (access_code_id) {
    // return error that you cannt access the access codes
    return res.redirect("/error.html?type=auth&errorCode=403&details=You cannot access the access codes");
  }
  if (req.user.role == "admin" || req.user.role == "ptt") {
    return res.sendFile(path.join(__dirname, "public", "tempAccess.html"));
  }
  return res.redirect("/error.html?type=auth&errorCode=403&details=Unauthorized");
});

module.exports = router;
