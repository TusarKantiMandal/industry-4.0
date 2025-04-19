const express = require("express");
const router = express.Router();

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
  if(req.user.role == "itAdmin") return res.redirect("/admin/it");
  if(req.user.role == "ptt") return res.redirect("/admin/ptt");
  if(req.user.role == "admin") {
    return res.send(`
      <h1>Welcome to the admin panel</h1>
      <p>Click <a href="/admin/it">here</a> to go to the IT admin panel</p>
      <p>Click <a href="/admin/ptt">here</a> to go to the PTT admin panel</p>
    `);
  }
  return res.redirect("/error.html?type=auth&errorCode=403&details=Unauthorized");
});


module.exports = router;
