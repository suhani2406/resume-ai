console.log("🚀 LOCAL ATS ANALYZER RUNNING");

const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "client")));

const skillBank = [
  "java",
  "python",
  "c++",
  "javascript",
  "react",
  "node.js",
  "express",
  "mongodb",
  "sql",
  "mysql",
  "postgresql",
  "aws",
  "docker",
  "kubernetes",
  "git",
  "github",
  "linux",
  "rest api",
  "api",
  "system design",
  "data structures",
  "algorithms",
  "oop",
  "object oriented programming",
  "problem solving",
  "distributed systems",
  "microservices",
  "cloud",
  "typescript",
  "html",
  "css",
  "tailwind",
  "database",
  "debugging",
  "testing",
  "deployment",
  "vercel",
];

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}.pdf`);
  },
});

const upload = multer({ storage });

app.post("/ai-score", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume file missing." });
    }

    const jobDescription = (req.body.jobDescription || "").toLowerCase();

    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    const resumeText = data.text.toLowerCase();

    const jdKeywords = skillBank.filter((skill) =>
      jobDescription.includes(skill)
    );

    const matchedKeywords = jdKeywords.filter((skill) =>
      resumeText.includes(skill)
    );

    const missingKeywords = jdKeywords.filter((skill) =>
      !resumeText.includes(skill)
    );

    const atsScore =
      jdKeywords.length > 0
        ? Math.round((matchedKeywords.length / jdKeywords.length) * 100)
        : 0;

    const suggestions = [];

    if (missingKeywords.length > 0) {
      suggestions.push(
        `Add or highlight these missing skills if you know them: ${missingKeywords
          .slice(0, 10)
          .join(", ")}`
      );
    }

    if (!resumeText.includes("projects")) {
      suggestions.push("Add a clear Projects section with 2–3 strong projects.");
    }

    if (!resumeText.includes("skills")) {
      suggestions.push("Add a dedicated Skills section.");
    }

    if (!resumeText.includes("experience") && !resumeText.includes("internship")) {
      suggestions.push("Add internship, freelance, open-source, or project experience.");
    }

    if (!resumeText.includes("github")) {
      suggestions.push("Add your GitHub link.");
    }

    if (!resumeText.includes("leetcode")) {
      suggestions.push("Add coding practice/DSA profile if relevant.");
    }

    fs.unlinkSync(req.file.path);

    res.json({
      atsScore,
      matchedKeywords,
      missingKeywords,
      suggestions,
    });
  } catch (err) {
    console.error("FULL ERROR:", err);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: err.message || "Resume analysis failed.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});