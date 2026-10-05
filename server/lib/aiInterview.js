require("dotenv").config();
const OpenAI = require("openai");

// Uses Google's Gemini through its OpenAI-compatible endpoint, so the rest
// of the code (chat.completions etc.) works unchanged.
// Put GEMINI_API_KEY in your .env. (OPENAI_API_KEY is still read as a
// fallback so your existing .env keeps working.)
const MODEL = process.env.AI_MODEL || "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "";
}

let client = null;
function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey, baseURL: BASE_URL });
  return client;
}

function requireClient() {
  const ai = getClient();
  if (!ai) {
    const err = new Error(
      "GEMINI_API_KEY is not set. Add it to a .env file locally, or to " +
        "your deployment platform's environment variables."
    );
    err.code = "MISSING_API_KEY";
    throw err;
  }
  return ai;
}

// Gemini sometimes wraps JSON in ```json fences even when asked not to.
function parseJsonLoose(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

// Shared helper: call the model with a JSON-only prompt and parse the
// result, normalizing both network errors and malformed-JSON errors.
async function callJsonPrompt(ai, prompt, temperature) {
  let completion;
  try {
    completion = await ai.chat.completions.create({
      model: MODEL,
      temperature,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    const status = e?.status;
    let detail;
    if (status === 401 || status === 403) {
      detail = "API key was rejected. Check GEMINI_API_KEY in your .env.";
    } else if (status === 429) {
      detail = "Rate limit reached (free tier). Wait a minute and try again.";
    } else if (status === 404) {
      detail = `Model "${MODEL}" was not found. Check the model name.`;
    } else {
      detail = e?.response?.data?.error?.message || e.message || String(e);
    }
    throw new Error(`AI request failed: ${detail}`);
  }

  try {
    return parseJsonLoose(completion.choices[0].message.content);
  } catch (e) {
    throw new Error("AI returned a response that wasn't valid JSON.");
  }
}

// ---------------------------------------------------------------------
// 1. Interview questions (HR / Technical / Mixed), tailored to a job
//    title the user typed, or inferred from the resume if left blank.
// ---------------------------------------------------------------------
async function generateInterviewQuestions({
  resumeText,
  jobDescription = "",
  jobTitle = "",
  round = "mixed", // "technical" | "hr" | "mixed"
}) {
  const ai = requireClient();

  const roundInstructions = {
    technical: `
Generate ONLY technical / role-specific questions (category must always be
"technical"). Cover the candidate's actual listed technologies, projects,
and claimed responsibilities — reference specific tools, stacks, or projects
by name where they appear in the resume, rather than asking generically.
Order roughly from easier/foundational to harder/design-level.`,
    hr: `
Generate ONLY HR / behavioral round questions (category must always be
"behavioral"). This is the human-round, not a technical screen — do NOT ask
about specific technologies, code, or system design. Instead, write
STAR-style questions ("Tell me about a time...", "Describe a situation
where...", "Walk me through...") grounded in details actually present in
the resume: specific companies, job titles, career transitions, gaps, team
sizes, project ownership, leadership, or conflicting priorities. Also
include standard HR staples adapted to this candidate: strengths/
weaknesses, why they're looking to move, salary/relocation expectations if
relevant, and long-term goals — phrased so they clearly reference this
candidate's actual background rather than being generic.`,
    mixed: `
Mix technical/role-specific questions with behavioral ones, ordered roughly
from easier to harder. Reference specific details from the resume (projects,
companies, technologies) wherever possible instead of asking generically.`,
  };
  const activeInstructions = roundInstructions[round] || roundInstructions.mixed;

  const titleInstruction = jobTitle
    ? `The candidate is explicitly targeting this role: "${jobTitle}". Tailor
every question to this exact title and seniority level — do not guess a
different title.`
    : `Infer the single most likely job title this candidate is targeting
(short string, e.g. "Frontend Developer" or "Data Analyst") and tailor
questions to it.`;

  const prompt = `
You are an expert interviewer conducting a ${
    round === "hr" ? "human resources / behavioral" : round === "technical" ? "technical" : "mixed technical + behavioral"
  } round.

${titleInstruction}

Generate 8 interview questions tailored to the role AND this specific
candidate's background, following these rules:
${activeInstructions}

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "jobTitle": "string",
  "questions": [
    { "question": "string", "category": "technical" }
  ]
}
Each question's "category" must be either "technical" or "behavioral".

RESUME TEXT:
"""
${resumeText.slice(0, 6000)}
"""

JOB DESCRIPTION (may be empty):
"""
${jobDescription.slice(0, 2000)}
"""
`.trim();

  const parsed = await callJsonPrompt(ai, prompt, 0.7);
  if (!parsed.jobTitle || !Array.isArray(parsed.questions)) {
    throw new Error("AI response was missing jobTitle or questions.");
  }
  // If the user explicitly gave us a title, trust it over whatever the
  // model echoes back.
  if (jobTitle) parsed.jobTitle = jobTitle;
  return parsed;
}

// ---------------------------------------------------------------------
// 2. AI-based ATS review — goes beyond flat keyword matching: looks at
//    structure, quantified impact, and ATS-parseability.
// ---------------------------------------------------------------------
async function generateAtsReview({ resumeText, jobDescription = "", jobTitle = "" }) {
  const ai = requireClient();

  const prompt = `
You are an ATS (Applicant Tracking System) + senior recruiter hybrid,
reviewing a resume against a target role${jobTitle ? ` ("${jobTitle}")` : ""}.

Score the resume from 0-100 on realistic ATS + recruiter criteria:
- keyword/skills overlap with the job description
- presence of standard sections (Summary, Skills, Experience/Projects, Education)
- quantified, impact-driven bullet points (numbers, metrics, outcomes)
- ATS-parseable formatting (flag if it looks like it may rely on tables,
  columns, images, or graphics that ATS systems often fail to parse —
  infer this only from text structure cues, don't assume)

Return ONLY valid JSON, no markdown fences:
{
  "atsScore": number,
  "strengths": ["string", ...],
  "gaps": ["string", ...],
  "formattingIssues": ["string", ...]
}
Keep each array to at most 5 concise, specific items.

RESUME TEXT:
"""
${resumeText.slice(0, 6000)}
"""

JOB DESCRIPTION (may be empty):
"""
${jobDescription.slice(0, 2000)}
"""
`.trim();

  const parsed = await callJsonPrompt(ai, prompt, 0.4);
  if (typeof parsed.atsScore !== "number") {
    throw new Error("AI response was missing atsScore.");
  }
  parsed.strengths = parsed.strengths || [];
  parsed.gaps = parsed.gaps || [];
  parsed.formattingIssues = parsed.formattingIssues || [];
  return parsed;
}

// ---------------------------------------------------------------------
// 3. Live interview: reaction after each spoken (transcribed) answer.
// ---------------------------------------------------------------------
async function generateReaction({ question, answer, jobTitle = "", history = [] }) {
  const ai = requireClient();

  const recentWeak = history.slice(-2);
  const pressureNote =
    recentWeak.length === 2
      ? `\nNote: the candidate's last two answers were notably vague or
thin. If this answer is also weak, ask a harder, more specific follow-up
on the SAME topic instead of moving on — apply a bit more pressure, the
way a real interviewer would when they're not satisfied yet.`
      : "";

  const prompt = `
You are conducting a live interview for a ${jobTitle || "candidate"} role.
You just asked:
"""
${question}
"""
The candidate answered (transcribed from speech, so it may contain small
transcription errors, filler words, or run-on sentences — don't penalize
that, focus on the substance):
"""
${answer.slice(0, 3000)}
"""
${pressureNote}

React the way a real interviewer would, in 1-3 short sentences: briefly
acknowledge what they said, and either affirm what was strong about it, or
gently probe/push back if it was vague, shallow, or dodged part of the
question. Do NOT restate the original question and do NOT introduce a
brand new unrelated topic — stay focused on what they just said,
conversationally.

Return ONLY valid JSON, no markdown fences:
{ "reaction": "string" }
`.trim();

  const parsed = await callJsonPrompt(ai, prompt, 0.7);
  if (!parsed.reaction) throw new Error("AI response was missing a reaction.");
  return parsed;
}

// ---------------------------------------------------------------------
// 4. Live interview: final report over the whole transcript.
// ---------------------------------------------------------------------
async function generateInterviewReport({ transcript, jobTitle = "" }) {
  const ai = requireClient();

  const transcriptText = transcript
    .map(
      (t, i) =>
        `Q${i + 1}${t.category ? ` (${t.category})` : ""}: ${t.question}\n` +
        `Candidate's answer: ${t.answer || "(no answer given)"}`
    )
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `
You are scoring a completed interview for a ${jobTitle || "candidate"} role.
Below is the full transcript of questions and the candidate's spoken (then
transcribed) answers.

"""
${transcriptText}
"""

For EACH question, score the answer from 1-5 (5 = excellent, 1 = very weak
or missing) and give one concrete, specific suggestion for how the
candidate could have answered better. Then give an overall score out of 100
and a short 2-3 sentence summary of the candidate's performance covering
both their strongest moment and the single biggest thing to improve.

Return ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "overallScore": number,
  "summary": "string",
  "items": [
    { "question": "string", "score": number, "feedback": "string" }
  ]
}
`.trim();

  const parsed = await callJsonPrompt(ai, prompt, 0.5);
  if (typeof parsed.overallScore !== "number" || !Array.isArray(parsed.items)) {
    throw new Error("AI response was missing overallScore or items.");
  }
  return parsed;
}

// ---------------------------------------------------------------------
// 5. Short spoken transition line between interview rounds (HR -> Tech).
// ---------------------------------------------------------------------
async function generateRoundTransition({ fromRound, toRound, jobTitle = "" }) {
  const ai = requireClient();
  const prompt = `
You are a live interviewer for a ${jobTitle || "candidate"} role, moving
from the ${fromRound} round to the ${toRound} round. Write ONE short,
natural, spoken transition line (max 20 words) an interviewer would say to
bridge the two, e.g. "Good, that covers the behavioral side — let's get
technical."

Return ONLY valid JSON, no markdown fences:
{ "transition": "string" }
`.trim();
  const parsed = await callJsonPrompt(ai, prompt, 0.6);
  return { transition: parsed.transition || "Let's move to the next round." };
}

module.exports = {
  generateInterviewQuestions,
  generateAtsReview,
  generateReaction,
  generateInterviewReport,
  generateRoundTransition,
};