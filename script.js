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
        
        // Show sections if data exists
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
    rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return;
        
        // Powerful regex to handle commas inside quotes
        const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        const type = cleanCols[0]?.toUpperCase();

        if (type === "TEXT") {
            normalTexts.push({ title: cleanCols[1], body: cleanCols[2] });
        } else if (type === "QUIZ") {
            quizData.push({
                question: cleanCols[1],
                choices: [cleanCols[2], cleanCols[3], cleanCols[4], cleanCols[5]],
                correct: parseInt(cleanCols[6]) || 0
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
    section.style.display = "block"; // Show the card
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
        
        // Auto-select different voices for different people
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

    // Highlight line
    dialogue.forEach((_, i) => {
        document.getElementById(`line-${i}`).style.background = (i === currentLine) ? "#e3f2fd" : "none";
    });

    ut.onend = () => { currentLine++; speakLine(); };
    speechSynthesis.speak(ut);
}

// ================= 4. QUIZ LOGIC =================
function loadQuestion() {
    const q = quizData[currentQuestion];
    document.getElementById("question").textContent = q.question;
    const div = document.getElementById("choices");
    div.innerHTML = "";
    
    q.choices.forEach((c, i) => {
        if(!c) return;
        const btn = document.createElement("button");
        btn.textContent = c;
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.style.margin = "5px 0";
        btn.style.padding = "10px";
        btn.onclick = () => {
            if(i === q.correct) { alert("Correct! ✨"); score++; }
            else { alert("Try again! 💪"); }
        };
        div.appendChild(btn);
    });
}

function nextQuestion() {
    currentQuestion++;
    if (currentQuestion < quizData.length) {
        loadQuestion();
    } else {
        document.getElementById("quiz-container").innerHTML = `<h2>Quiz Finished!</h2><p>Your Score: ${score}</p>`;
    }
}

// ================= 5. SYSTEM SETUP =================
function loadVoices() {
    voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en'));
    if (dialogue.length > 0) setupSpeakerControls();
}

function toggleRead() {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(document.getElementById("question").textContent));
}

function stopDialogue() { speechSynthesis.cancel(); }

speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;
