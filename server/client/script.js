document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.querySelector('input[type="file"]');
  const resultDiv = document.getElementById("result");
  const scoreP = document.getElementById("score");
  const tipsP = document.getElementById("tips");
  const strengthsP = document.getElementById("strengths");
  const weaknessesP = document.getElementById("weaknesses");

  const formData = new FormData();
  formData.append("resume", fileInput.files[0]);

  resultDiv.classList.remove("hidden");
  scoreP.textContent = "⏳ Analyzing...";
  tipsP.textContent = "";
  strengthsP.textContent = "";
  weaknessesP.textContent = "";

  try {
    const res = await fetch("http://localhost:5000/ai-score", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      scoreP.textContent = `${data.atsScore}/100`;
      strengthsP.textContent = `💪 Strengths: ${data.strengths.join(", ")}`;
      weaknessesP.textContent = `⚠️ Weaknesses: ${data.weaknesses.join(", ")}`;
      tipsP.textContent = `📈 Tips: ${data.improvementTips.join(", ")}`;
    } else {
      scoreP.textContent = `❌ Error: ${data.error}`;
    }
  } catch (err) {
    scoreP.textContent = `❌ Network Error: ${err.message}`;
  }
});
