const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLCn5weZR17UsAOd4Z8W0FlRwSnKiuJe2xdgWkrZtnEHObEaVXNAEIfVajhWuSbUi3FFNaITrouxmJ/pub?gid=439461232&single=true&output=csv";

let quizData = [];
let dialogue = [];
let normalTexts = []; 
let voices = [];
let currentQuestion = 0;
let score = 0;
let currentLine = 0;

// ================= 1. FETCH & PARSE =================
async function loadData() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        parseCSV(csvText);
        
        if (normalTexts.length > 0) renderNormalText();
        if (dialogue.length > 0) {
            setupSpeakerControls(); 
            renderDialogue();
        }
        if (quizData.length > 0) loadQuestion();
        
    } catch (e) {
        console.error("Connection Error:", e);
    }
}

function parseCSV(text) {
    const rows = text.split(/\r?\n/);
    quizData = []; // Clear current data
    rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return;
        
        const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        const type = cleanCols[0]?.toUpperCase();

        if (type === "TEXT") {
            normalTexts.push({ title: cleanCols[1], body: cleanCols[2] });
        } else if (type === "QUIZ") {
            // Part 1: Multiple Choice
            quizData.push({
                type: "MULTIPLE",
                question: cleanCols[1],
                choices: [cleanCols[2], cleanCols[3], cleanCols[4], cleanCols[5]],
                correct: parseInt(cleanCols[6]) || 0
            });
        } else if (type === "BLANKS") {
            // Part 2: Fill in the Blanks
            quizData.push({
                type: "BLANKS",
                sentence: cleanCols[1],
                correctAnswer: cleanCols[2]?.toLowerCase().trim()
            });
        } else if (type === "DIALOGUE") {
            dialogue.push({ speaker: cleanCols[1], text: cleanCols[2] });
        }
    });
}

// ================= 2. TEXT RENDERER =================
function renderNormalText() {
    const section = document.getElementById("text-section");
    const container = document.getElementById("text-container");
    section.style.display = "block"; 
    container.innerHTML = "";

    normalTexts.forEach(item => {
        const div = document.createElement("div");
        div.style.marginBottom = "20px";
        div.innerHTML = `<h2 style="color:#007bff;">${item.title}</h2><p style="font-size:1.1em; line-height:1.6;">${item.body}</p>`;
        container.appendChild(div);
    });
}

// ================= 3. DIALOGUE LOGIC =================
function setupSpeakerControls() {
    const container = document.getElementById("voice-controls-container");
    container.innerHTML = "";
    const uniqueSpeakers = [...new Set(dialogue.map(line => line.speaker))];

    uniqueSpeakers.forEach((speaker, index) => {
        const div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.innerHTML = `<strong>${speaker}'s Voice: </strong> <select id="voice-for-${speaker}"></select>`;
        container.appendChild(div);

        const select = document.getElementById(`voice-for-${speaker}`);
        voices.forEach((v, i) => select.add(new Option(v.name, i)));
        if (index < voices.length) select.selectedIndex = index;
    });
}

function renderDialogue() {
    const cont = document.getElementById("fullDialogue");
    cont.innerHTML = "";
    dialogue.forEach((line, i) => {
        const d = document.createElement("div");
        d.id = `line-${i}`;
        d.style.padding = "10px";
        d.style.borderRadius = "5px";
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
    const sel = document.getElementById(`voice-for-${line.speaker}`);
    if (sel) ut.voice = voices[sel.value];

    dialogue.forEach((_, i) => {
        document.getElementById(`line-${i}`).style.background = (i === currentLine) ? "#e3f2fd" : "none";
    });

    ut.onend = () => { currentLine++; speakLine(); };
    speechSynthesis.speak(ut);
}

// ================= 4. QUIZ LOGIC (MULTIPLE & BLANKS) =================
function loadQuestion() {
    const container = document.getElementById("quiz-list");
    const submitBtn = document.getElementById("submit-btn");
    const resetBtn = document.getElementById("reset-btn");
    
    container.innerHTML = ""; 
    
    quizData.forEach((q, qIndex) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question-block";
        qDiv.style.marginBottom = "25px";
        qDiv.style.padding = "15px";
        qDiv.style.borderBottom = "1px solid #eee";

        if (q.type === "BLANKS") {
            // Render Fill in the Blanks
            const parts = q.sentence.split("___");
            qDiv.innerHTML = `
                <h4>${qIndex + 1}. Fill in the Blank:</h4>
                <p style="font-size: 1.2em;">
                    ${parts[0]} 
                    <input type="text" id="blank-${qIndex}" class="blank-input"
                        style="border: none; border-bottom: 2px solid #007bff; width: 140px; text-align: center; outline: none; font-size: 1em;"
                        placeholder="..."> 
                    ${parts[1] || ""}
                </p>
                <div id="fb-${qIndex}" style="font-weight: bold; margin-top: 5px;"></div>
            `;
        } else {
            // Render Multiple Choice
            qDiv.innerHTML = `<h4>${qIndex + 1}. ${q.question}</h4>`;
            const choicesDiv = document.createElement("div");
            q.choices.forEach((choice, cIndex) => {
                if (!choice) return;
                const label = document.createElement("label");
                label.style.display = "block";
                label.style.cursor = "pointer";
                label.style.padding = "5px";
                label.style.borderRadius = "4px";
                label.id = `label-q${qIndex}-c${cIndex}`;
                label.innerHTML = `<input type="radio" name="question${qIndex}" value="${cIndex}"> ${choice}`;
                choicesDiv.appendChild(label);
            });
            qDiv.appendChild(choicesDiv);
        }
        container.appendChild(qDiv);
    });

    if (quizData.length > 0) {
        if (submitBtn) submitBtn.style.display = "inline-block";
        if (resetBtn) resetBtn.style.display = "inline-block";
    }
}

function submitQuiz() {
    let finalScore = 0;
    const resultDiv = document.getElementById("quiz-result");

    quizData.forEach((q, qIndex) => {
        if (q.type === "BLANKS") {
            const input = document.getElementById(`blank-${qIndex}`);
            const fb = document.getElementById(`fb-${qIndex}`);
            const userAns = input.value.toLowerCase().trim();

            if (userAns === q.correctAnswer) {
                finalScore++;
                input.style.color = "#28a745";
                input.style.borderBottomColor = "#28a745";
                fb.innerHTML = "Correct! ✨";
                fb.style.color = "#28a745";
            } else {
                input.style.color = "#dc3545";
                input.style.borderBottomColor = "#dc3545";
                fb.innerHTML = `Wrong. Answer: ${q.correctAnswer}`;
                fb.style.color = "#dc3545";
            }
        } else {
            const selected = document.querySelector(`input[name="question${qIndex}"]:checked`);
            
            q.choices.forEach((_, cIndex) => {
                const lbl = document.getElementById(`label-q${qIndex}-c${cIndex}`);
                if (lbl) {
                    lbl.style.background = "none";
                    lbl.style.color = "black";
                    lbl.style.border = "none";
                }
            });

            if (selected) {
                const answerIndex = parseInt(selected.value);
                if (answerIndex === q.correct) {
                    finalScore++;
                    const correctLbl = document.getElementById(`label-q${qIndex}-c${answerIndex}`);
                    correctLbl.style.background = "#d4edda"; 
                    correctLbl.style.color = "#155724";
                } else {
                    const wrongLbl = document.getElementById(`label-q${qIndex}-c${answerIndex}`);
                    wrongLbl.style.background = "#f8d7da"; 
                    wrongLbl.style.color = "#721c24";
                    const correctLbl = document.getElementById(`label-q${qIndex}-c${q.correct}`);
                    correctLbl.style.background = "#d4edda";
                }
            } else {
                const correctLbl = document.getElementById(`label-q${qIndex}-c${q.correct}`);
                correctLbl.style.border = "2px dashed #28a745";
            }
        }
    });

    // Score Feedback Logic
    const isPerfect = finalScore === quizData.length && quizData.length > 0;
    if (isPerfect) {
        resultDiv.innerHTML = `<div style="color: #28a745; text-align: center;">
                                    <h2>Great Job! 🌟</h2>
                                    <p style="font-size: 1.5em;">Perfect Score: ${finalScore} / ${quizData.length}</p>
                                </div>`;
    } else {
        resultDiv.innerHTML = `<div style="text-align: center;">
                                    <h3>Your Score: ${finalScore} / ${quizData.length}</h3>
                                    <p style="color: #666;">Keep practicing to get a perfect score!</p>
                                </div>`;
    }
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function resetQuiz() {
    // We simply reload the question template to clear everything
    loadQuestion();
    const resultDiv = document.getElementById("quiz-result");
    if (resultDiv) resultDiv.innerHTML = "";
    document.getElementById("quiz-container").scrollIntoView({ behavior: 'smooth' });
}

// ================= 5. SYSTEM SETUP =================
function loadVoices() {
    voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en'));
    if (dialogue.length > 0) setupSpeakerControls();
}

speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;
