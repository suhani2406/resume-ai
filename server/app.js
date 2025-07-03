const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client'))); // Serve frontend

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}.pdf`);
  }
});
const upload = multer({ storage });

// Resume Analyzer Endpoint (no OpenAI)
app.post('/ai-score', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "Resume file missing." });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    const wordCount = text.trim().split(/\s+/).length;

    const techKeywords = ["JavaScript", "React", "Node.js", "SQL", "Python", "MongoDB", "C++", "Java"];
    const softSkills = ["communication", "leadership", "teamwork", "problem-solving"];
    const sections = ["Experience", "Education", "Projects", "Skills", "Certifications"];

    let techScore = 0;
    let softScore = 0;
    let sectionScore = 0;

    techKeywords.forEach(k => text.toLowerCase().includes(k.toLowerCase()) && (techScore += 8));
    softSkills.forEach(s => text.toLowerCase().includes(s.toLowerCase()) && (softScore += 5));
    sections.forEach(s => text.toLowerCase().includes(s.toLowerCase()) && (sectionScore += 4));

    const formatScore = wordCount >= 300 && wordCount <= 700 ? 20 : 10;
    const totalScore = Math.min(techScore, 40) + Math.min(softScore, 20) + Math.min(sectionScore, 20) + formatScore;

    const strengths = [];
    const weaknesses = [];
    const improvementTips = [];

    if (techScore >= 30) strengths.push("Good technical skill coverage");
    else improvementTips.push("Add more relevant tech skills like JavaScript, SQL, Node.js");

    if (softScore >= 15) strengths.push("Strong soft skills highlighted");
    else improvementTips.push("Mention teamwork, communication, or leadership skills");

    if (sectionScore >= 15) strengths.push("Well-structured resume with all key sections");
    else improvementTips.push("Include all key sections: Projects, Experience, Education, etc.");

    if (formatScore >= 15) strengths.push("Perfect resume length");
    else improvementTips.push("Keep resume between 300–700 words (1–2 pages)");

    fs.unlinkSync(req.file.path);

    res.json({
      atsScore: totalScore,
      strengths,
      weaknesses,
      improvementTips
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Resume scoring failed." });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
