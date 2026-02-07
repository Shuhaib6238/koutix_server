const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("SAP POS Mock Running");
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";   // REQUIRED for SAP

app.listen(PORT, HOST, () => {
  console.log("Server running on " + HOST + ":" + PORT);
});