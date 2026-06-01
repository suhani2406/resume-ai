const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}.pdf`);
  },
});

const upload = multer({ storage });

function extractKeywords(text) {
  const stopWords = [
    "and", "or", "the", "a", "an", "to", "of",
    "in", "for", "with", "on", "by", "is",
    "are", "be", "this", "that", "as", "from"
  ];

  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !stopWords.includes(word)
    );
}

app.post("/ai-score", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Resume file missing",
      });
    }

    const jobDescription =
      req.body.jobDescription || "";

    const pdfBuffer = fs.readFileSync(
      req.file.path
    );

    const data = await pdfParse(pdfBuffer);

    const resumeText = data.text.toLowerCase();

    const jdKeywords = [
      ...new Set(extractKeywords(jobDescription)),
    ];

    const matchedKeywords = jdKeywords.filter(
      (keyword) =>
        resumeText.includes(keyword)
    );

    const missingKeywords = jdKeywords.filter(
      (keyword) =>
        !resumeText.includes(keyword)
    );

    const atsScore =
      jdKeywords.length > 0
        ? Math.round(
            (matchedKeywords.length /
              jdKeywords.length) *
              100
          )
        : 0;

    const suggestions = [];

    if (missingKeywords.length > 0) {
      suggestions.push(
        `Add keywords like: ${missingKeywords
          .slice(0, 10)
          .join(", ")}`
      );
    }

    if (!resumeText.includes("projects")) {
      suggestions.push(
        "Add a Projects section."
      );
    }

    if (!resumeText.includes("skills")) {
      suggestions.push(
        "Add a Skills section."
      );
    }

    if (!resumeText.includes("experience")) {
      suggestions.push(
        "Add Experience or Internship details."
      );
    }

    fs.unlinkSync(req.file.path);

    res.json({
      atsScore,
      matchedKeywords,
      missingKeywords,
      suggestions,
    });
  } catch (err) {
    console.error(err);

    if (
      req.file?.path &&
      fs.existsSync(req.file.path)
    ) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Resume analysis failed",
    });
  }
});

module.exports = app;