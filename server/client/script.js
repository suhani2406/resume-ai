document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.querySelector('input[type="file"]');
  const jobDescription = document.getElementById("jobDescription").value;
  const faangFocus = document.getElementById("faangFocus").value;

  const resultDiv = document.getElementById("result");
  const scoreP = document.getElementById("score");
  const matchedDiv = document.getElementById("matched");
  const missingDiv = document.getElementById("missing");
  const suggestionsUl = document.getElementById("suggestions");

  if (!fileInput.files[0]) {
    alert("Please upload a resume PDF.");
    return;
  }

  const finalJD = `${jobDescription} ${faangFocus}`;

  const formData = new FormData();
  formData.append("resume", fileInput.files[0]);
  formData.append("jobDescription", finalJD);

  resultDiv.classList.remove("hidden");
  scoreP.textContent = "⏳ Analyzing...";
  matchedDiv.innerHTML = "";
  missingDiv.innerHTML = "";
  suggestionsUl.innerHTML = "";

  try {
    const res = await fetch("http://localhost:5000/ai-score", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      scoreP.textContent = `${data.atsScore}/100`;

      matchedDiv.innerHTML = data.matchedKeywords.length
        ? data.matchedKeywords
            .slice(0, 25)
            .map((keyword) => `<span>${keyword}</span>`)
            .join("")
        : "<p>No matched keywords found.</p>";

      missingDiv.innerHTML = data.missingKeywords.length
        ? data.missingKeywords
            .slice(0, 25)
            .map((keyword) => `<span>${keyword}</span>`)
            .join("")
        : "<p>No missing keywords found.</p>";

      suggestionsUl.innerHTML = data.suggestions.length
        ? data.suggestions.map((tip) => `<li>${tip}</li>`).join("")
        : "<li>Your resume matches this JD well.</li>";
    } else {
      scoreP.textContent = `❌ Error: ${data.error}`;
    }
  } catch (err) {
    scoreP.textContent = `❌ Network Error: ${err.message}`;
  }
});