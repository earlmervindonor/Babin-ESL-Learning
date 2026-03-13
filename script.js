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
    quizData = []; 
    rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return;
        
        const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        const type = cleanCols[0]?.toUpperCase();

        if (type === "TEXT") {
            normalTexts.push({ title: cleanCols[1], body: cleanCols[2] });
        } else if (type === "QUIZ") {
            quizData.push({
                type: "MULTIPLE",
                question: cleanCols[1],
                choices: [cleanCols[2], cleanCols[3], cleanCols[4], cleanCols[5]],
                correct: parseInt(cleanCols[6]) || 0
            });
        } else if (type === "BLANKS") {
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
    if (!section) return;
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
    if (!container) return;
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
    if (!cont) return;
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
        const el = document.getElementById(`line-${i}`);
        if(el) el.style.background = (i === currentLine) ? "#e3f2fd" : "none";
    });

    ut.onend = () => { currentLine++; speakLine(); };
    speechSynthesis.speak(ut);
}

// ================= 4. QUIZ LOGIC (SEPARATE CONTROLS) =================

function loadQuestion() {
    const container = document.getElementById("quiz-list");
    if (!container) return;
    
    container.innerHTML = ""; 

    // --- PART 1: MULTIPLE CHOICE ---
    const mcQuestions = quizData.filter(q => q.type === "MULTIPLE");
    if (mcQuestions.length > 0) {
        const part1Section = document.createElement("div");
        part1Section.id = "part-1-section";
        part1Section.innerHTML = `<h3 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 5px;">Part I: Multiple Choice</h3>`;
        
        mcQuestions.forEach((q, i) => {
            const realIdx = quizData.indexOf(q);
            part1Section.appendChild(renderQuestionElement(q, realIdx, i + 1));
        });
        
        const p1Controls = document.createElement("div");
        p1Controls.style.cssText = "margin: 20px 0; display: flex; flex-direction: column; align-items: center;";
        p1Controls.innerHTML = `
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="submitPart(1)" style="padding:10px 20px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer;">Submit Part I</button>
                <button onclick="resetPart(1)" style="padding:10px 20px; background:#6c757d; color:white; border:none; border-radius:5px; cursor:pointer;">Reset Part I</button>
            </div>
            <div id="quiz-result-1" style="margin-top:15px; font-weight:bold; text-align: center;"></div>
        `;
        part1Section.appendChild(p1Controls);
        container.appendChild(part1Section);
    }

    // --- PART 2: FILL IN THE BLANKS ---
    const blankQuestions = quizData.filter(q => q.type === "BLANKS");
    if (blankQuestions.length > 0) {
        const part2Section = document.createElement("div");
        part2Section.id = "part-2-section";
        part2Section.style.marginTop = "50px";
        part2Section.innerHTML = `<h3 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 5px;">Part II: Fill in the Blanks</h3>`;

        const bankDiv = document.createElement("div");
        bankDiv.style.cssText = "background:#f1f8ff; border:2px solid #007bff; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center;";
        const words = blankQuestions.map(q => q.correctAnswer).sort(() => Math.random() - 0.5);
        bankDiv.innerHTML = `<p style="margin-top:0; font-weight:bold; color:#007bff;">Word Bank</p>`;
        
        words.forEach((word) => {
            const span = document.createElement("span");
            span.innerText = word;
            span.draggable = true;
            span.style.cssText = "display:inline-block; margin:5px; padding:8px 15px; background:white; border:1px solid #007bff; border-radius:5px; cursor:grab; font-weight:bold; user-select:none;";
            span.ondragstart = (e) => e.dataTransfer.setData("text", e.target.innerText);
            bankDiv.appendChild(span);
        });
        part2Section.appendChild(bankDiv);

        blankQuestions.forEach((q, i) => {
            const realIdx = quizData.indexOf(q);
            part2Section.appendChild(renderQuestionElement(q, realIdx, i + 1));
        });
        
        const p2Controls = document.createElement("div");
        p2Controls.style.cssText = "margin: 20px 0; display: flex; flex-direction: column; align-items: center;";
        p2Controls.innerHTML = `
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="submitPart(2)" style="padding:10px 20px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer;">Submit Part II</button>
                <button onclick="resetPart(2)" style="padding:10px 20px; background:#6c757d; color:white; border:none; border-radius:5px; cursor:pointer;">Reset Part II</button>
            </div>
            <div id="quiz-result-2" style="margin-top:15px; font-weight:bold; text-align: center;"></div>
        `;
        part2Section.appendChild(p2Controls);
        container.appendChild(part2Section);
    }
}

function renderQuestionElement(q, realIndex, displayNum) {
    const qDiv = document.createElement("div");
    qDiv.className = "question-block";
    qDiv.style.cssText = "margin-bottom:20px; padding:15px; border-bottom:1px solid #eee;";

    if (q.type === "BLANKS") {
        const parts = q.sentence.split("___");
        qDiv.innerHTML = `
            <p style="font-size:1.15em;">
                <strong>${displayNum}.</strong> ${parts[0]} 
                <input type="text" id="blank-${realIndex}" class="part2-input" 
                    style="border:none; border-bottom:2px solid #007bff; width:140px; text-align:center; font-size:1em; outline:none; background:#fffdec; border-radius:4px;" 
                    placeholder="" readonly> 
                ${parts[1] || ""}
            </p>
            <div id="fb-${realIndex}" class="part2-feedback" style="font-weight:bold; margin-top:5px;"></div>
        `;
        const input = qDiv.querySelector('.part2-input');
        input.ondragover = (e) => e.preventDefault();
        input.ondrop = (e) => {
            e.preventDefault();
            e.target.value = e.dataTransfer.getData("text");
            e.target.style.background = "#e3f2fd";
        };
    } else {
        qDiv.innerHTML = `<h4>${displayNum}. ${q.question}</h4>`;
        const choicesDiv = document.createElement("div");
        q.choices.forEach((choice, cIndex) => {
            if (!choice) return;
            const label = document.createElement("label");
            label.className = "part1-label";
            label.style.cssText = "display:block; cursor:pointer; padding:5px; border-radius:4px;";
            label.id = `label-q${realIndex}-c${cIndex}`;
            label.innerHTML = `<input type="radio" name="question${realIndex}" value="${cIndex}"> ${choice}`;
            choicesDiv.appendChild(label);
        });
        qDiv.appendChild(choicesDiv);
    }
    return qDiv;
}

// ================= 5. SEPARATE SUBMIT/RESET LOGIC =================

function submitPart(partNum) {
    let partScore = 0;
    let totalInPart = 0;
    const typeToFilter = (partNum === 1) ? "MULTIPLE" : "BLANKS";
    const resultDiv = document.getElementById(`quiz-result-${partNum}`);
    
    quizData.forEach((q, qIndex) => {
        if (q.type !== typeToFilter) return;
        totalInPart++;

        if (q.type === "BLANKS") {
            const input = document.getElementById(`blank-${qIndex}`);
            const fb = document.getElementById(`fb-${qIndex}`);
            if (!input) return;
            const userAns = input.value.toLowerCase().trim();
            if (userAns === q.correctAnswer) {
                partScore++;
                input.style.color = "#28a745"; fb.innerHTML = "Correct! ✨"; fb.style.color = "#28a745";
            } else {
                input.style.color = "#dc3545"; fb.innerHTML = `Wrong. Answer: ${q.correctAnswer}`; fb.style.color = "#dc3545";
            }
        } else {
            const selected = document.querySelector(`input[name="question${qIndex}"]:checked`);
            q.choices.forEach((_, i) => {
                const lbl = document.getElementById(`label-q${qIndex}-c${i}`);
                if (lbl) { lbl.style.background = "none"; lbl.style.color = "black"; lbl.style.border = "none"; }
            });
            if (selected) {
                const ansIdx = parseInt(selected.value);
                if (ansIdx === q.correct) {
                    partScore++;
                    document.getElementById(`label-q${qIndex}-c${ansIdx}`).style.background = "#d4edda";
                } else {
                    document.getElementById(`label-q${qIndex}-c${ansIdx}`).style.background = "#f8d7da";
                    document.getElementById(`label-q${qIndex}-c${q.correct}`).style.background = "#d4edda";
                }
            } else {
                const correctLbl = document.getElementById(`label-q${qIndex}-c${q.correct}`);
                if (correctLbl) correctLbl.style.border = "1px dashed #28a745";
            }
        }
    });

    const isPerfect = partScore === totalInPart;
    resultDiv.innerHTML = isPerfect ? 
        `<span style="color:#28a745;">Great Job! Perfect Score: ${partScore}/${totalInPart} 🌟</span>` :
        `Part ${partNum} Score: ${partScore} / ${totalInPart}`;
}

function resetPart(partNum) {
    if (partNum === 1) {
        const section = document.getElementById("part-1-section");
        if (!section) return;
        section.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        section.querySelectorAll('.part1-label').forEach(lbl => {
            lbl.style.background = "none";
            lbl.style.color = "black";
            lbl.style.border = "none";
        });
        document.getElementById("quiz-result-1").innerHTML = "";
    } else {
        const section = document.getElementById("part-2-section");
        if (!section) return;
        section.querySelectorAll('.part2-input').forEach(input => {
            input.value = "";
            input.style.background = "#fffdec";
            input.style.color = "black";
        });
        section.querySelectorAll('.part2-feedback').forEach(fb => fb.innerHTML = "");
        document.getElementById("quiz-result-2").innerHTML = "";
    }
}

// ================= 6. SYSTEM SETUP =================
function loadVoices() {
    voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en'));
    if (dialogue.length > 0) setupSpeakerControls();
}

speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;
