# 📄 Resume AI Analyzer

Upload your resume in PDF format and get instant AI-powered feedback — including an ATS (Applicant Tracking System) score, strengths, weaknesses, and personalized tips for improvement!

> 🚀 Built with Node.js, Express, OpenAI GPT, and vanilla JavaScript frontend.

---

## ✨ Features

- ✅ Upload your resume (PDF only)
- 🤖 Analyze resume content using AI (OpenAI GPT)
- 🧠 Get ATS Score (out of 100)
- 💪 See strengths and weaknesses
- 📈 Receive smart improvement suggestions
- ⚡ Fast analysis with a beautiful UI

---

## 🛠️ Tech Stack

| Layer       | Technology Used                         |
|-------------|------------------------------------------|
| Frontend    | HTML, Tailwind CSS, JavaScript           |
| Backend     | Node.js, Express.js                      |
| File Upload | Multer                                   |
| Resume Text | pdf-parse                                |
| AI Scoring  | OpenAI GPT-4 API                         |
| Deployment  | (Coming Soon) Vercel (frontend), Render (backend) |

---

## 🖼️ Demo Preview

![Resume AI Preview](./screenshot.png) <!-- Add a screenshot here -->

---

## 🧪 How It Works

1. Upload a resume (PDF only)
2. Backend extracts text using `pdf-parse`
3. Sends text to OpenAI GPT for scoring and analysis
4. Returns a structured JSON:
   ```json
   {
     "atsScore": 78,
     "strengths": ["Well-structured", "Good technical coverage"],
     "weaknesses": ["Missing certifications"],
     "improvementTips": ["Add more soft skills like leadership and]()
