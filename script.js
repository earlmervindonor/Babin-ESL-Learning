// ================= 0. DYNAMIC CONFIGURATION =================
const BASE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLCn5weZR17UsAOd4Z8W0FlRwSnKiuJe2xdgWkrZtnEHObEaVXNAEIfVajhWuSbUi3FFNaITrouxmJ/pub?single=true&output=csv";

function getTargetUrl() {
    const pageName = window.location.pathname.split("/").pop();
    let gid = "439461232"; // Default sheet (Home/General)
    
    if (pageName === "work-life-balance.html") { 
        gid = "2001320284"; 
    } else if (pageName === "workplace-ethics.html") { 
        gid = "2072343238"; 
    } else if (pageName === "restaurant.html") { 
        gid = "1968398657"; 
    }
    
    return `${BASE_CSV_URL}&gid=${gid}`;
}
const CSV_URL = getTargetUrl();
let quizData = [];
let dialogue = [];
let normalTexts = []; 
let voices = [];
let currentLine = 0;
let isSpeaking = false; 

// ================= 1. FETCH & PARSE =================
async function loadData() {
    try {
        const response = await fetch(CSV_URL);
        const csvText = await response.text();
        parseCSV(csvText);
        
        if (normalTexts.length > 0) renderNormalText();
        
        if (dialogue.length > 0) {
            const voiceControls = document.getElementById("voice-controls-container");
            if (voiceControls) {
                setupSpeakerControls(); 
                renderDialogue();
            }
        }
        if (quizData.length > 0) loadQuestion();
    } catch (e) { console.error("Connection Error:", e); }
}

function parseCSV(text) {
    const rows = text.split(/\r?\n/);
    quizData = []; dialogue = []; normalTexts = [];
    rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return;
        const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());
        const type = cleanCols[0]?.toUpperCase();
        
        if (type === "TEXT") {
            normalTexts.push({ title: cleanCols[1], body: cleanCols[2] });
        } else if (type === "HEADING") {
            quizData.push({ type: "HEADING", title: cleanCols[1] });
        } else if (type === "QUIZ") {
            quizData.push({ type: "MULTIPLE", question: cleanCols[1], choices: [cleanCols[2], cleanCols[3], cleanCols[4], cleanCols[5]], correct: parseInt(cleanCols[6]) || 0 });
        } else if (type === "BLANKS") {
            quizData.push({ type: "BLANKS", sentence: cleanCols[1], correctAnswer: cleanCols[2]?.toLowerCase().trim() });
        } else if (type === "MATCHING") {
            quizData.push({ type: "MATCHING", term: cleanCols[1], definition: cleanCols[2] });
        } else if (type === "DIALOGUE") {
            dialogue.push({ speaker: cleanCols[1], text: cleanCols[2] });
        } 
        else if (type === "SPELLING") {
            quizData.push({ type: "SPELLING", hint: cleanCols[1], correctAnswer: cleanCols[2]?.toLowerCase().trim() });
        }
    });
}

// ================= 2. TEXT RENDERER =================
function renderNormalText() {
    const section = document.getElementById("text-section");
    const container = document.getElementById("text-container");
    if (!section || !container) return;
    
    section.style.display = "block"; 
    container.innerHTML = "";

    normalTexts.forEach(item => {
        const div = document.createElement("div");
        div.style.marginBottom = "20px";
        div.innerHTML = `
            <h2 style="color:#007bff; font-style: italic;">${item.title || ""}</h2>
            <p style="font-size:1.1em; line-height:1.6; margin-left: 10px;">${item.body || ""}</p>
        `;
        container.appendChild(div);
    });
}

// ================= 3. AUDIO LOGIC (WITH STOP FEATURE) =================
function setupSpeakerControls() {
    const container = document.getElementById("voice-controls-container");
    if (!container) return; container.innerHTML = "";
    const uniqueSpeakers = [...new Set(dialogue.map(line => line.speaker))];
    uniqueSpeakers.forEach((speaker) => {
        const div = document.createElement("div");
        div.innerHTML = `<strong>${speaker}:</strong> <select id="voice-for-${speaker}"></select>`;
        container.appendChild(div);
        voices.forEach((v, i) => document.getElementById(`voice-for-${speaker}`).add(new Option(v.name, i)));
    });
}

function renderDialogue() {
    const cont = document.getElementById("fullDialogue");
    if (cont) cont.innerHTML = dialogue.map((line, i) => `<div id="line-${i}" style="padding:5px; border-radius:4px;"><strong>${line.speaker}:</strong> ${line.text}</div>`).join("");
}

function playDialogue() { 
    speechSynthesis.cancel(); 
    isSpeaking = true; 
    currentLine = 0; 
    speakLine(); 
}

function stopDialogue() { 
    isSpeaking = false; 
    speechSynthesis.cancel(); 
    dialogue.forEach((_, i) => {
        const el = document.getElementById(`line-${i}`);
        if(el) el.style.background = "none";
    });
}

function speakLine() {
    if (!isSpeaking || currentLine >= dialogue.length) {
        isSpeaking = false;
        return;
    }
    
    const line = dialogue[currentLine];
    const ut = new SpeechSynthesisUtterance(line.text);
    const sel = document.getElementById(`voice-for-${line.speaker}`);
    if (sel && voices[sel.value]) ut.voice = voices[sel.value];

    dialogue.forEach((_, i) => {
        const el = document.getElementById(`line-${i}`);
        if(el) el.style.background = (i === currentLine) ? "#e3f2fd" : "none";
    });

    ut.onend = () => { 
        if (isSpeaking) {
            currentLine++; 
            speakLine(); 
        }
    };
    speechSynthesis.speak(ut);
}

// ================= 4. QUIZ LOGIC =================
function loadQuestion() {
    const container = document.getElementById("quiz-list");
    if (!container) return;
    container.innerHTML = ""; 

    let sectionIndex = 0;
    let currentSectionDiv = null;
    let questionCounter = 1;

    const allMatchingDefs = quizData.filter(q => q.type === "MATCHING").map(q => q.definition);
    const shuffledMatchingDefs = [...allMatchingDefs].sort(() => Math.random() - 0.5);

    quizData.forEach((item, index) => {
        if (item.type === "HEADING") {
            if (currentSectionDiv) addSectionControls(container, sectionIndex++);
            
            currentSectionDiv = document.createElement("div");
            currentSectionDiv.id = `section-${sectionIndex}`;
            currentSectionDiv.style.cssText = "margin-bottom: 40px; padding: 20px; border: 1px solid #eee; border-radius: 12px; background: #fff;";
            currentSectionDiv.innerHTML = `<h3 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 8px;">${item.title}</h3>`;
            container.appendChild(currentSectionDiv);

            const sectionBlanks = [];
            for (let i = index + 1; i < quizData.length; i++) {
                if (quizData[i].type === "HEADING") break;
                if (quizData[i].type === "BLANKS") sectionBlanks.push(quizData[i].correctAnswer);
                // REMOVED SPELLING FROM WORD BANK
            }

            if (sectionBlanks.length > 0) {
                const bank = document.createElement("div");
                bank.style.cssText = "background:#f8f9fa; border:2px solid #007bff; padding:15px; border-radius:10px; margin: 15px 0; text-align:center;";
                bank.innerHTML = `<p style="font-weight:bold; color: #007bff;">Word Bank</p>`;
                sectionBlanks.sort(() => Math.random() - 0.5).forEach(word => {
                    bank.innerHTML += `<span draggable="true" ondragstart="event.dataTransfer.setData('text', '${word}')" 
                        style="display:inline-block; margin:5px; padding:6px 15px; font-weight:bold; color: black; background-color: #b2d5fa; border:1px solid #007bff; border-radius:5px; cursor:grab;">${word}</span>`;
                });
                currentSectionDiv.appendChild(bank);
            }
            questionCounter = 1; 
        } else if (currentSectionDiv) {
            currentSectionDiv.appendChild(renderQuestionElement(item, index, questionCounter++, shuffledMatchingDefs));
        }
    });
    if (currentSectionDiv) addSectionControls(container, sectionIndex);
}

function renderQuestionElement(q, realIndex, displayNum, shuffledDefs) {
    const qDiv = document.createElement("div");
    qDiv.style.cssText = "margin-bottom:20px; padding:10px;";

    if (q.type === "BLANKS") {
        const parts = q.sentence.split("___");
        qDiv.innerHTML = `
            <p><strong>${displayNum}.</strong> ${parts[0]} 
            <input type="text" id="blank-${realIndex}" 
                   ondragover="event.preventDefault()" 
                   ondrop="event.preventDefault(); this.value=event.dataTransfer.getData('text')"
                   style="border:none; border-radius: 5px; border-bottom:2px solid #007bff; width:140px; text-align:center; background: #fffdec; font-size:1em; font-weight:bold;"> ${parts[1] || ""}</p>
            <div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px; font-size:0.9em;"></div>`;
    } 
    else if (q.type === "SPELLING") {
        qDiv.innerHTML = `
            <p><strong>${displayNum}. Spell the word:</strong> <i style="color:#555;">(Type the correct word manually)</i></p>
            <input type="text" id="spelling-${realIndex}" 
                   style="border:none; border-bottom:2px solid #28a745; width:180px; text-align:center; background: #f0fff4; font-size:1em; font-weight:bold; outline:none;">
            <div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px; font-size:0.9em;"></div>`;
    }
    else if (q.type === "MATCHING") {
        qDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px;">
                <span style="font-weight: bold;">${q.term}</span>
                <select id="match-${realIndex}" style="padding: 8px; border-radius: 5px; border: 1px solid #007bff; font-size:1em; font-weight:bold; text-align:center;">
                    <option value="">-- Choose Definition --</option>
                    ${shuffledDefs.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>
            <div id="fb-${realIndex}" style="font-weight:bold; font-size:0.9em; text-align: right;"></div>`;
    } else {
        qDiv.innerHTML = `<h4>${displayNum}. ${q.question}</h4>`;
        q.choices.forEach((choice, cIndex) => {
            if (!choice) return;
            qDiv.innerHTML += `<label id="label-q${realIndex}-c${cIndex}" style="display:block; padding:4px;">
                <input type="radio" name="question${realIndex}" value="${cIndex}"> ${choice}</label>`;
        });
        qDiv.innerHTML += `<div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px;"></div>`;
    }
    return qDiv;
}

function addSectionControls(container, idx) {
    const div = document.createElement("div");
    div.style.cssText = "text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;";
    div.innerHTML = `
        <button onclick="submitSection(${idx})" style="padding:10px 25px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Submit Results</button>
        <button onclick="resetSection(${idx})" style="padding:10px 25px; background:#6c757d; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">Reset</button>
        <div id="score-${idx}" style="margin-top:20px; padding:15px; border-radius:10px; display:none;"></div>`;
    container.lastChild.appendChild(div);
}

// ================= 5. SUBMIT WITH GRADING & REMARKS =================
function submitSection(sIdx) {
    const section = document.getElementById(`section-${sIdx}`);
    let score = 0, total = 0;
    
    quizData.forEach((q, idx) => {
        const fb = section.querySelector(`#fb-${idx}`);
        if (!fb) return;
        
        const spelling = section.querySelector(`#spelling-${idx}`);
        const blank = section.querySelector(`#blank-${idx}`);
        const radio = section.querySelector(`input[name="question${idx}"]`);
        const match = section.querySelector(`#match-${idx}`);

        if (spelling) {
            total++;
            if (spelling.value.toLowerCase().trim() === q.correctAnswer) {
                score++; fb.innerHTML="Correct! ✨"; fb.style.color="#28a745";
            } else {
                fb.innerHTML=`Incorrect. Correct spelling: "${q.correctAnswer}"`; fb.style.color="#dc3545";
            }
        }
        else if (blank) {
            total++;
            if (blank.value.toLowerCase().trim() === q.correctAnswer) { 
                score++; fb.innerHTML="Correct! ✨"; fb.style.color="#28a745"; 
            } else { 
                fb.innerHTML=`The correct answer is "${q.correctAnswer}"`; fb.style.color="#dc3545"; 
            }
        } else if (match) {
            total++;
            if (match.value === q.definition) { 
                score++; fb.innerHTML="✓ Correct"; fb.style.color="#28a745"; 
            } else { 
                fb.innerHTML=`The correct answer is "${q.definition}"`; fb.style.color="#dc3545"; 
            }
        } else if (radio) {
            total++;
            const sel = section.querySelector(`input[name="question${idx}"]:checked`);
            const isCorrect = sel && parseInt(sel.value) === q.correct;
            
            if (isCorrect) { 
                score++; fb.innerHTML="Correct! ✨"; fb.style.color="#28a745";
            } else { 
                const correctText = q.choices[q.correct];
                fb.innerHTML = `The correct answer is "${correctText}"`; 
                fb.style.color="#dc3545";
                const correctLabel = section.querySelector(`#label-q${idx}-c${q.correct}`);
                if (correctLabel) correctLabel.style.background = "#d4edda";
            }
        }
    });

    const scoreDiv = document.getElementById(`score-${sIdx}`);
    const percentage = (score / total) * 100;
    
    let message = percentage === 100 ? "🌟 Good job! Perfect Score!" : (percentage >= 70 ? "✨ Great effort!" : "📖 Keep it up! Try again!");
    let bgColor = percentage === 100 ? "#d4edda" : (percentage >= 70 ? "#fff3cd" : "#f8d7da");
    let textColor = percentage === 100 ? "#155724" : (percentage >= 70 ? "#856404" : "#721c24");

    scoreDiv.style.display = "block";
    scoreDiv.style.backgroundColor = bgColor;
    scoreDiv.style.color = textColor;
    scoreDiv.style.border = `1px solid ${textColor}`;
    scoreDiv.style.padding = "15px";
    scoreDiv.style.borderRadius = "10px";
    scoreDiv.style.marginTop = "20px";
    
    scoreDiv.innerHTML = `<strong>${message}</strong><br>Score: ${score} / ${total} (${percentage.toFixed(0)}%)`;
    scoreDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetSection(sIdx) {
    const section = document.getElementById(`section-${sIdx}`);
    section.querySelectorAll('input[type="text"]').forEach(i => i.value="");
    section.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    section.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    section.querySelectorAll('[id^="fb-"]').forEach(f => f.innerHTML="");
    section.querySelectorAll('[id^="label-q"]').forEach(l => l.style.background = "none");
    const scoreDiv = document.getElementById(`score-${sIdx}`);
    if (scoreDiv) scoreDiv.style.display = "none";
}

function loadVoices() { voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en')); }
speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;

function updatePHTime() {
    const timeElement = document.getElementById('ph-time');
    const dateElement = document.getElementById('ph-date');

    const now = new Date();

    const timeOptions = {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const dateOptions = {
        timeZone: 'Asia/Manila',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    if(timeElement) timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
    if(dateElement) dateElement.textContent = now.toLocaleDateString('en-US', dateOptions).toUpperCase();
}

setInterval(updatePHTime, 1000);
updatePHTime();
