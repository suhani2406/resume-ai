const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const path = require("path");
const {
  generateInterviewQuestions,
  generateAtsReview,
  generateReaction,
  generateInterviewReport,
  generateRoundTransition,
} = require("./lib/aiInterview");

// ---------------------------------------------------------------------
// Skill bank for the fast, non-AI ATS score (works with no API key).
// Each key is the canonical skill name shown to the user; the array holds
// alternate spellings that should count as the same skill.
// Add more skills here as you see jobs that need them.
// ---------------------------------------------------------------------
const skillBank = {
  java: [],
  python: [],
  "c++": ["cpp"],
  javascript: ["ecmascript"],
  typescript: [],
  react: ["reactjs", "react.js"],
  "node.js": ["nodejs", "node js"],
  express: ["express.js", "expressjs"],
  mongodb: ["mongo db", "mongo"],
  sql: [],
  mysql: [],
  postgresql: ["postgres"],
  aws: ["amazon web services"],
  docker: [],
  kubernetes: ["k8s"],
  git: [],
  github: [],
  linux: [],
  "rest api": ["restful", "rest apis", "restful api"],
  api: ["apis"],
  "system design": [],
  "data structures": [],
  algorithms: [],
  oop: ["object oriented programming", "object-oriented programming", "object oriented"],
  "problem solving": ["problem-solving"],
  "distributed systems": [],
  microservices: ["micro-services", "microservice"],
  cloud: [],
  html: ["html5"],
  css: ["css3"],
  tailwind: ["tailwindcss", "tailwind css"],
  database: ["databases"],
  debugging: [],
  testing: [],
  deployment: [],
  vercel: [],
  "next.js": ["nextjs", "next js"],
  redis: [],
  graphql: [],
  "ci/cd": ["cicd", "ci cd"],
};

// Extra resume-only evidence. The job description must name the skill, but
// the resume can prove it with related terms (resumes rarely say
// "problem solving" literally; they show it through DSA, LeetCode, etc.).
const impliedBy = {
  "problem solving": [
    "algorithms", "data structures", "dsa", "leetcode", "codeforces",
    "codechef", "competitive programming", "hackerrank", "geeksforgeeks",
  ],
  "system design": ["architecture", "scalable", "scalability", "low level design", "hld", "lld"],
  database: ["sql", "mysql", "postgresql", "mongodb", "redis"],
  api: ["rest api", "restful", "express", "graphql"],
  cloud: ["aws", "azure", "gcp", "google cloud"],
  deployment: ["vercel", "netlify", "render", "heroku", "docker", "aws", "ci/cd"],
  testing: ["jest", "mocha", "unit test", "junit", "pytest", "cypress", "selenium"],
  debugging: ["troubleshoot", "bug fix", "bug fixes"],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-term match, so "java" does not match "javascript" and "git" does
// not match "github". Characters a-z, 0-9, + and # count as part of a word
// (so "c++" and "c#" work); everything else is a boundary.
function hasTerm(text, term) {
  const re = new RegExp(
    `(^|[^a-z0-9+#])${escapeRegex(term)}($|[^a-z0-9+#])`,
    "i"
  );
  return re.test(text);
}

// True if the canonical skill or any of its aliases appears in the text.
function hasSkill(text, skill) {
  return [skill, ...skillBank[skill]].some((term) => hasTerm(text, term));
}

// Resume check: the skill itself, its aliases, or related evidence.
function resumeHasSkill(text, skill) {
  if (hasSkill(text, skill)) return true;
  return (impliedBy[skill] || []).some((term) => hasTerm(text, term));
}

function createApp({ serveClient = false } = {}) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(cors());
  app.use(express.json());

  if (serveClient) {
    app.use(express.static(path.join(__dirname, "..", "client")));
  }

  // -------------------------------------------------------------------
  // POST /ai-score
  // Form fields: resume (PDF file), jobDescription, jobTitle, round
  // -------------------------------------------------------------------
  app.post("/ai-score", upload.single("resume"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Resume file missing." });
      }

      const jobDescriptionRaw = req.body.jobDescription || "";
      const jobTitle = (req.body.jobTitle || "").trim();
      const jobDescription = jobDescriptionRaw.toLowerCase();
      const round = ["technical", "hr", "mixed"].includes(req.body.round)
        ? req.body.round
        : "mixed";

      const data = await pdfParse(req.file.buffer);
      const resumeText = data.text.toLowerCase();

      // --- Fast keyword-based ATS score (skill bank only) ---
      const jdKeywords = Object.keys(skillBank).filter((s) =>
        hasSkill(jobDescription, s)
      );
      const matchedKeywords = jdKeywords.filter((k) => resumeHasSkill(resumeText, k));
      const missingKeywords = jdKeywords.filter((k) => !resumeHasSkill(resumeText, k));

      const atsScore =
        jdKeywords.length > 0
          ? Math.round((matchedKeywords.length / jdKeywords.length) * 100)
          : 0;

      const suggestions = [];
      if (jdKeywords.length === 0) {
        suggestions.push(
          "No recognizable skills were found in the job description, so the keyword score isn't meaningful. Try pasting the full description."
        );
      }
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

      // --- AI layer: deeper ATS review + interview questions. Best-effort:
      // don't fail the whole request if the API key is missing, out of
      // credits, or a call errors out. The keyword score above still returns. ---
      let aiAts = null;
      let aiAtsError = null;
      try {
        aiAts = await generateAtsReview({
          resumeText: data.text,
          jobDescription: jobDescriptionRaw,
          jobTitle,
        });
      } catch (err) {
        console.error("AI ATS review failed:", err.message);
        aiAtsError = "AI review is unavailable right now. The keyword score above still applies.";
      }

      let jobTitleOut = jobTitle || null;
      let interviewQuestions = [];
      let interviewError = null;
      try {
        const result = await generateInterviewQuestions({
          resumeText: data.text,
          jobDescription: jobDescriptionRaw,
          jobTitle,
          round,
        });
        jobTitleOut = result.jobTitle;
        interviewQuestions = result.questions;
      } catch (err) {
        console.error("Interview questions failed:", err.message);
        interviewError = "Interview questions are unavailable right now. Please try again later.";
      }

      res.json({
        atsScore,
        matchedKeywords,
        missingKeywords,
        suggestions,
        aiAts,
        aiAtsError,
        jobTitle: jobTitleOut,
        interviewQuestions,
        interviewError,
      });
    } catch (err) {
      console.error("FULL ERROR:", err);
      res.status(500).json({ error: err.message || "Resume analysis failed." });
    }
  });

  // Live interview: reaction after each transcribed spoken answer.
  app.post("/interview-react", async (req, res) => {
    try {
      const { question, answer, jobTitle, history } = req.body || {};
      if (!question || !answer) {
        return res.status(400).json({ error: "question and answer are required." });
      }
      const result = await generateReaction({
        question,
        answer,
        jobTitle,
        history: Array.isArray(history) ? history : [],
      });
      res.json(result);
    } catch (err) {
      console.error("interview-react error:", err);
      res.status(500).json({ error: err.message || "Failed to generate reaction." });
    }
  });

  // Live interview: final per-question + overall report.
  app.post("/interview-report", async (req, res) => {
    try {
      const { transcript, jobTitle } = req.body || {};
      if (!Array.isArray(transcript) || transcript.length === 0) {
        return res.status(400).json({ error: "transcript is required." });
      }
      const result = await generateInterviewReport({ transcript, jobTitle });
      res.json(result);
    } catch (err) {
      console.error("interview-report error:", err);
      res.status(500).json({ error: err.message || "Failed to generate report." });
    }
  });

  // Short spoken transition line between rounds (e.g. HR -> Technical).
  app.post("/round-transition", async (req, res) => {
    try {
      const { fromRound, toRound, jobTitle } = req.body || {};
      if (!fromRound || !toRound) {
        return res.status(400).json({ error: "fromRound and toRound are required." });
      }
      const result = await generateRoundTransition({ fromRound, toRound, jobTitle });
      res.json(result);
    } catch (err) {
      console.error("round-transition error:", err);
      res.status(500).json({ error: err.message || "Failed to generate transition." });
    }
  });

  return app;
}

module.exports = { createApp };