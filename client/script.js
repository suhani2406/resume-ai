// Shared state for the live (voice) interview flow.
const startInterviewState = {
  jobTitle: "",
  questions: [], // [{ question, category }]
  index: 0,
  transcriptLog: [], // [{ question, category, answer }]
  lastSeenCategory: null,
  speechMuted: false,
};

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("resume");
  const jobTitleInput = document.getElementById("jobTitleInput").value.trim();
  const jobDescription = document.getElementById("jobDescription").value;
  const faangFocus = document.getElementById("faangFocus").value;
  const interviewRound = document.getElementById("interviewRound").value;

  const resultDiv = document.getElementById("result");
  const scoreP = document.getElementById("score");
  const matchedDiv = document.getElementById("matched");
  const missingDiv = document.getElementById("missing");
  const suggestionsUl = document.getElementById("suggestions");

  const aiAtsDiv = document.getElementById("aiAtsResult");
  const aiAtsErrorMsg = document.getElementById("aiAtsErrorMsg");
  const aiAtsBody = document.getElementById("aiAtsBody");
  const aiAtsScore = document.getElementById("aiAtsScore");
  const aiAtsStrengths = document.getElementById("aiAtsStrengths");
  const aiAtsGaps = document.getElementById("aiAtsGaps");
  const aiAtsFormatting = document.getElementById("aiAtsFormatting");

  const interviewDiv = document.getElementById("interviewResult");
  const jobTitleSpan = document.getElementById("jobTitle");
  const interviewErrorMsg = document.getElementById("interviewErrorMsg");
  const interviewQuestionsOl = document.getElementById("interviewQuestions");

  if (!fileInput.files[0]) {
    alert("Please upload a resume PDF.");
    return;
  }

  const finalJD = `${jobDescription} ${faangFocus}`;

  const formData = new FormData();
  formData.append("resume", fileInput.files[0]);
  formData.append("jobDescription", finalJD);
  formData.append("jobTitle", jobTitleInput);
  formData.append("round", interviewRound);

  resultDiv.classList.remove("hidden");
  aiAtsDiv.classList.remove("hidden");
  interviewDiv.classList.remove("hidden");
  scoreP.textContent = "";
  matchedDiv.innerHTML = "";
  missingDiv.innerHTML = "";
  suggestionsUl.innerHTML = "";
  aiAtsErrorMsg.classList.add("hidden");
  aiAtsBody.classList.add("hidden");
  jobTitleSpan.textContent = "";
  interviewErrorMsg.classList.add("hidden");
  interviewQuestionsOl.innerHTML = "";

  scoreP.textContent = "⏳ Analyzing...";
  aiAtsStrengths.innerHTML = "<li>⏳ Running AI review...</li>";
  interviewQuestionsOl.innerHTML = "<li>⏳ Generating tailored questions...</li>";

  try {
    const res = await fetch("/ai-score", { method: "POST", body: formData });

    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      console.error("Non-JSON response from server:", raw);
      scoreP.textContent = res.ok
        ? "❌ Error: Server sent an empty or invalid response (it may have crashed or restarted mid-request)."
        : `❌ Error: Server returned status ${res.status} with no readable body.`;
      interviewQuestionsOl.innerHTML = "";
      aiAtsStrengths.innerHTML = "";
      return;
    }

    if (!res.ok) {
      scoreP.textContent = `❌ Error: ${data.error}`;
      interviewQuestionsOl.innerHTML = "";
      aiAtsStrengths.innerHTML = "";
      return;
    }

    // --- Keyword ATS ---
    scoreP.textContent = `${data.atsScore}/100`;
    matchedDiv.innerHTML = data.matchedKeywords.length
      ? data.matchedKeywords.slice(0, 25).map((k) => `<span>${k}</span>`).join("")
      : "<p>No matched keywords found.</p>";
    missingDiv.innerHTML = data.missingKeywords.length
      ? data.missingKeywords.slice(0, 25).map((k) => `<span>${k}</span>`).join("")
      : "<p>No missing keywords found.</p>";
    suggestionsUl.innerHTML = data.suggestions.length
      ? data.suggestions.map((tip) => `<li>${tip}</li>`).join("")
      : "<li>Your resume matches this JD well.</li>";

    // --- AI ATS review ---
    if (data.aiAtsError) {
      aiAtsErrorMsg.textContent = `Couldn't generate AI review: ${data.aiAtsError}`;
      aiAtsErrorMsg.classList.remove("hidden");
      aiAtsStrengths.innerHTML = "";
    } else if (data.aiAts) {
      aiAtsBody.classList.remove("hidden");
      aiAtsScore.textContent = data.aiAts.atsScore;
      aiAtsStrengths.innerHTML = data.aiAts.strengths.length
        ? data.aiAts.strengths.map((s) => `<li>${s}</li>`).join("")
        : "<li>None noted.</li>";
      aiAtsGaps.innerHTML = data.aiAts.gaps.length
        ? data.aiAts.gaps.map((s) => `<li>${s}</li>`).join("")
        : "<li>None noted.</li>";
      aiAtsFormatting.innerHTML = data.aiAts.formattingIssues.length
        ? data.aiAts.formattingIssues.map((s) => `<li>${s}</li>`).join("")
        : "<li>None noted.</li>";
    }

    // --- Interview questions ---
    interviewQuestionsOl.innerHTML = "";
    document.getElementById("startLiveInterviewBtn").classList.add("hidden");

    if (data.jobTitle) jobTitleSpan.textContent = `— ${data.jobTitle}`;

    if (data.interviewError) {
      interviewErrorMsg.textContent = `Couldn't generate questions: ${data.interviewError}`;
      interviewErrorMsg.classList.remove("hidden");
    } else if (data.interviewQuestions && data.interviewQuestions.length) {
      interviewQuestionsOl.innerHTML = data.interviewQuestions
        .map(
          (q) =>
            `<li><span class="q-category ${q.category}">${q.category}</span> ${q.question}</li>`
        )
        .join("");
      startInterviewState.jobTitle = data.jobTitle || "";
      startInterviewState.questions = data.interviewQuestions;
      document.getElementById("startLiveInterviewBtn").classList.remove("hidden");
    } else {
      interviewQuestionsOl.innerHTML = "<li>No questions were generated.</li>";
    }
  } catch (err) {
    scoreP.textContent = `❌ Network Error: ${err.message}`;
    interviewQuestionsOl.innerHTML = "";
  }
});

// ============================================================
// Live (voice) interview
// ============================================================

const liveInterviewSection = document.getElementById("liveInterview");
const interviewReportSection = document.getElementById("interviewReport");
const liveQuestionP = document.getElementById("liveQuestion");
const liveProgressSpan = document.getElementById("liveProgress");
const roundTransitionLine = document.getElementById("roundTransitionLine");
const liveAnswerText = document.getElementById("liveAnswerText");
const micBtn = document.getElementById("micBtn");
const micStatus = document.getElementById("micStatus");
const muteBtn = document.getElementById("muteBtn");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const aiReactionDiv = document.getElementById("aiReaction");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

// --- Text-to-speech for the AI interviewer (reactions + questions) ---
function speak(text) {
  if (startInterviewState.speechMuted) return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  window.speechSynthesis.speak(utter);
}

muteBtn.addEventListener("click", () => {
  startInterviewState.speechMuted = !startInterviewState.speechMuted;
  muteBtn.textContent = startInterviewState.speechMuted ? "🔇" : "🔊";
  muteBtn.classList.toggle("muted", startInterviewState.speechMuted);
  if (startInterviewState.speechMuted) window.speechSynthesis?.cancel();
});

// --- Speech recognition setup (Chrome/Edge). Falls back to typing only. ---
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognizing = false;

if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let finalizedText = "";

  recognition.onstart = () => {
    recognizing = true;
    micBtn.textContent = "⏹ Stop Answering";
    micStatus.textContent = "🔴 Listening...";
    finalizedText = liveAnswerText.value ? liveAnswerText.value + " " : "";
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalizedText += chunk + " ";
      else interim += chunk;
    }
    liveAnswerText.value = (finalizedText + interim).trim();
  };

  recognition.onerror = (event) => {
    micStatus.textContent = `⚠️ Mic error: ${event.error}`;
  };

  recognition.onend = () => {
    recognizing = false;
    micBtn.textContent = "🎤 Start Answering";
    micStatus.textContent = "";
  };
} else {
  micBtn.disabled = true;
  micStatus.textContent = "🎤 Voice input isn't supported in this browser — type your answer instead.";
}

micBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (recognizing) recognition.stop();
  else recognition.start();
});

function categoryLabel(cat) {
  return cat === "technical" ? "Technical" : "HR / Behavioral";
}

async function maybeAnnounceRoundChange() {
  const q = startInterviewState.questions[startInterviewState.index];
  const prevCategory = startInterviewState.lastSeenCategory;
  roundTransitionLine.classList.add("hidden");
  roundTransitionLine.textContent = "";

  if (prevCategory && prevCategory !== q.category) {
    try {
      const res = await fetch("/round-transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRound: categoryLabel(prevCategory),
          toRound: categoryLabel(q.category),
          jobTitle: startInterviewState.jobTitle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.transition) {
        roundTransitionLine.textContent = `🗣️ ${data.transition}`;
        roundTransitionLine.classList.remove("hidden");
        speak(data.transition);
      }
    } catch {
      // Non-critical — just skip the transition line on failure.
    }
  }
  startInterviewState.lastSeenCategory = q.category;
}

async function loadLiveQuestion() {
  const q = startInterviewState.questions[startInterviewState.index];
  const total = startInterviewState.questions.length;
  liveProgressSpan.textContent = `— ${categoryLabel(q.category)} · Q${startInterviewState.index + 1} of ${total}`;

  await maybeAnnounceRoundChange();

  liveQuestionP.innerHTML = `<span class="q-category ${q.category}">${q.category}</span> ${q.question}`;
  liveAnswerText.value = "";
  aiReactionDiv.classList.add("hidden");
  aiReactionDiv.textContent = "";
  nextQuestionBtn.classList.add("hidden");
  submitAnswerBtn.classList.remove("hidden");
  submitAnswerBtn.disabled = false;
  submitAnswerBtn.textContent = "Submit Answer";
  if (recognizing && recognition) recognition.stop();

  speak(q.question);
}

document.getElementById("startLiveInterviewBtn").addEventListener("click", () => {
  startInterviewState.index = 0;
  startInterviewState.transcriptLog = [];
  startInterviewState.lastSeenCategory = null;
  liveInterviewSection.classList.remove("hidden");
  interviewReportSection.classList.add("hidden");
  loadLiveQuestion();
  liveInterviewSection.scrollIntoView({ behavior: "smooth" });
});

submitAnswerBtn.addEventListener("click", async () => {
  const answer = liveAnswerText.value.trim();
  if (!answer) {
    alert("Please answer (by voice or typing) before submitting.");
    return;
  }
  if (recognizing && recognition) recognition.stop();

  const q = startInterviewState.questions[startInterviewState.index];
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.textContent = "⏳ Thinking...";

  const logEntry = { question: q.question, category: q.category, answer };
  startInterviewState.transcriptLog.push(logEntry);

  try {
    const res = await fetch("/interview-react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q.question,
        answer,
        jobTitle: startInterviewState.jobTitle,
        // Last couple of Q&A pairs, so the bot can apply more pressure if
        // recent answers were weak — mirrors a real interviewer's tone shift.
        history: startInterviewState.transcriptLog.slice(-3, -1),
      }),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      aiReactionDiv.textContent = "⚠️ Server sent an empty/invalid response.";
      aiReactionDiv.classList.remove("hidden");
      nextQuestionBtn.classList.remove("hidden");
      submitAnswerBtn.classList.add("hidden");
      return;
    }

    if (!res.ok) {
      aiReactionDiv.textContent = `⚠️ ${data.error || "Couldn't get a reaction."}`;
    } else {
      aiReactionDiv.textContent = `🗣️ ${data.reaction}`;
      speak(data.reaction);
    }
    aiReactionDiv.classList.remove("hidden");
    nextQuestionBtn.classList.remove("hidden");
    submitAnswerBtn.classList.add("hidden");
  } catch (err) {
    aiReactionDiv.textContent = `⚠️ Network error: ${err.message}`;
    aiReactionDiv.classList.remove("hidden");
    nextQuestionBtn.classList.remove("hidden");
    submitAnswerBtn.classList.add("hidden");
  }
});

nextQuestionBtn.addEventListener("click", async () => {
  startInterviewState.index += 1;
  if (startInterviewState.index < startInterviewState.questions.length) {
    await loadLiveQuestion();
  } else {
    await finishInterview();
  }
});

async function finishInterview() {
  liveInterviewSection.classList.add("hidden");
  interviewReportSection.classList.remove("hidden");

  const overallScoreP = document.getElementById("overallScore");
  const reportSummaryP = document.getElementById("reportSummary");
  const reportItemsDiv = document.getElementById("reportItems");

  overallScoreP.textContent = "⏳ Scoring your interview...";
  reportSummaryP.textContent = "";
  reportItemsDiv.innerHTML = "";
  interviewReportSection.scrollIntoView({ behavior: "smooth" });

  try {
    const res = await fetch("/interview-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: startInterviewState.transcriptLog,
        jobTitle: startInterviewState.jobTitle,
      }),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      overallScoreP.textContent = "⚠️ Server sent an empty/invalid response.";
      return;
    }

    if (!res.ok) {
      overallScoreP.textContent = `⚠️ ${data.error || "Couldn't generate report."}`;
      return;
    }

    overallScoreP.textContent = `${data.overallScore}/100`;
    reportSummaryP.textContent = data.summary;
    reportItemsDiv.innerHTML = data.items
      .map(
        (item, i) => `
        <div class="report-item">
          <p class="report-item-q"><strong>Q${i + 1}.</strong> ${item.question}</p>
          <p class="report-item-score">Score: ${item.score}/5</p>
          <p class="report-item-feedback">${item.feedback}</p>
        </div>`
      )
      .join("");
  } catch (err) {
    overallScoreP.textContent = `⚠️ Network error: ${err.message}`;
  }
}
