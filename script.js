const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLCn5weZR17UsAOd4Z8W0FlRwSnKiuJe2xdgWkrZtnEHObEaVXNAEIfVajhWuSbUi3FFNaITrouxmJ/pub?gid=439461232&single=true&output=csv";

let quizData = [];
let dialogue = [];
let currentQuestion = 0;
let score = 0;
let voices = [];
let currentLine = 0;

// ================= 1. FETCH & POWER PARSER =================
async function loadData() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        parseCSV(csvText);
        
        if (quizData.length > 0) loadQuestion();
        if (dialogue.length > 0) renderDialogue();
    } catch (e) {
        console.error("Connection Error:", e);
    }
}

function parseCSV(text) {
    quizData = [];
    dialogue = [];

    // This logic handles line breaks and commas perfectly
    const rows = text.split(/\r?\n/);
    
    rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return;

        // NEW: This regex is much stronger for "complete text"
        // It captures everything between commas, even if it contains symbols
        const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        if (cleanCols.length < 2) return;

        const type = cleanCols[0].toUpperCase();

        if (type === "QUIZ") {
            quizData.push({
                question: cleanCols[1],
                choices: [cleanCols[2], cleanCols[3], cleanCols[4], cleanCols[5]],
                correct: parseInt(cleanCols[6]) || 0
            });
        } else if (type === "DIALOGUE") {
            // This will push EVERY line found in the sheet into the array
            dialogue.push({
                speaker: cleanCols[1],
                text: cleanCols[2]
            });
        }
    });
}

// ================= 2. DIALOGUE (Multi-Line Support) =================
function renderDialogue() {
    const cont = document.getElementById("fullDialogue");
    cont.innerHTML = ""; // Clear old data
    
    // This loops through EVERY dialogue entry found in your sheet
    dialogue.forEach((line, i) => {
        const d = document.createElement("div");
        d.id = `line-${i}`;
        d.className = "dialogue-line";
        d.innerHTML = `<strong>${line.speaker}:</strong> ${line.text}`;
        cont.appendChild(d);
    });
}

function playDialogue() {
    speechSynthesis.cancel();
    currentLine = 0;
    speakLine();
}

function speakLine() {
    if (currentLine >= dialogue.length) return;

    const line = dialogue[currentLine];
    const ut = new SpeechSynthesisUtterance(line.text);
    
    // Voice Selection
    const mIdx = document.getElementById("mikeVoice").value;
    const jIdx = document.getElementById("johnVoice").value;
    ut.voice = (line.speaker.toLowerCase().includes("mike")) ? voices[mIdx] : voices[jIdx];

    // Visual Highlight
    document.querySelectorAll('.dialogue-line').forEach(el => el.style.background = "none");
    const currentEl = document.getElementById(`line-${currentLine}`);
    if (currentEl) currentEl.style.background = "#e3f2fd";

    ut.onend = () => {
        currentLine++;
        speakLine();
    };
    speechSynthesis.speak(ut);
}

// ================= 3. QUIZ (Complete Text) =================
function loadQuestion() {
    const q = quizData[currentQuestion];
    const qText = document.getElementById("question");
    qText.textContent = q.question; // Displays the FULL question text
    
    const div = document.getElementById("choices");
    div.innerHTML = "";
    
    q.choices.forEach((c, i) => {
        if(!c) return; // Skip empty choices
        const btn = document.createElement("button");
        btn.textContent = c;
        btn.className = "choice-btn";
        btn.onclick = () => {
            if(i === q.correct) alert("Excellent! ✨");
            else alert("Keep trying! 💪");
        };
        div.appendChild(btn);
    });
}

function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < quizData.length) {
        loadQuestion();
    } else {
        document.getElementById("quiz-container").innerHTML = `<h2>Quiz Complete!</h2><p>Refresh to try again.</p>`;
    }
}

// ================= 4. INITIALIZATION =================
function loadVoices() {
    voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en'));
    const m = document.getElementById("mikeVoice");
    const j = document.getElementById("johnVoice");
    if (m && voices.length > 0) {
        m.innerHTML = j.innerHTML = "";
        voices.forEach((v, i) => {
            m.add(new Option(v.name, i));
            j.add(new Option(v.name, i));
        });
        if(voices.length > 1) j.selectedIndex = 1;
    }
}

function toggleRead() {
    speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(document.getElementById("question").textContent);
    speechSynthesis.speak(ut);
}

function stopDialogue() { speechSynthesis.cancel(); }

speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;