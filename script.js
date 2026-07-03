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
    } else if (pageName === "sports-lesson.html") { 
        gid = "1523259985"; 
    }else if (pageName === "library.html") { 
        gid = "793325724"; 
    }else if (pageName === "bus-stop.html") { 
        gid = "2010016043"; 
    }else if (pageName === "super-market.html") { 
        gid = "1566605369"; 
    }else if (pageName === "kitchen-cooking.html") { 
        gid = "940942358"; 
    }else if (pageName === "park.html") { 
        gid = "880505373"; 
    }else if (pageName === "museums.html") { 
        gid = "131366028"; 
    }else if (pageName === "school-life.html") { 
        gid = "1750677535"; 
    }else if (pageName === "hospital-healthcare.html") { 
        gid = "124706539"; 
    }else if (pageName === "hotels-airports.html") { 
        gid = "1190919462"; 
    }else if (pageName === "commuting-directions.html") { 
        gid = "1576104761"; 
    }else if (pageName === "cafe.html") { 
        gid = "273304741"; 
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

        loadNoteFromSheet(); 

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
        else if (type === "SCRAMBLE") {
         quizData.push({ type: "SCRAMBLE", hint: cleanCols[1], correctAnswer: cleanCols[2]?.toUpperCase().trim() });
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

// ================= 3. AUDIO LOGIC =================
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

// Optimized helper function to handle whole phrase shuffling safely
function scrambleWordPhrase(phrase) {
    if (!phrase || phrase.length <= 1) return phrase;
    
    let letters = phrase.split('');
    let scrambled;
    let attempts = 0;

    // Perform standard Fisher-Yates shuffle on the entire sequence (including spaces)
    do {
        for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        scrambled = letters.join('');
        attempts++;
    } while (scrambled === phrase && attempts < 20); // Prevent infinite loops but ensure it alternates

    // Fallback if shuffle randomly hits perfect structure
    if (scrambled === phrase) {
        return phrase.substring(1) + phrase.charAt(0);
    }
    return scrambled;
}

// Handler logic for clicking interaction on letter blocks (Adjusted to hide styling for space tokens inside target zone)
function handleScrambleLetterClick(letterEl, realIndex) {
    const targetBox = document.getElementById(`scramble-target-${realIndex}`);
    const poolBox = document.getElementById(`scramble-pool-${realIndex}`);
    const hiddenInput = document.getElementById(`scramble-${realIndex}`);
    const placeholder = document.getElementById(`placeholder-${realIndex}`);

    if (placeholder) placeholder.style.display = 'none';

    const isSpace = letterEl.getAttribute('data-letter') === ' ';

    // Toggle location between pool box and assignment zone
    if (letterEl.parentNode === poolBox) {
        targetBox.appendChild(letterEl);
        
        if (isSpace) {
            // Make it look like an unstyled clear spacing bar within target box
            letterEl.style.backgroundColor = 'transparent';
            letterEl.style.boxShadow = 'none';
            letterEl.style.color = 'transparent';
            letterEl.style.border = 'none';
        } else {
            letterEl.style.backgroundColor = '#28a745'; // Highlight positive text element change
        }
    } else {
        poolBox.appendChild(letterEl);
        
        if (isSpace) {
            // Restore normal slate look back in pool layout
            letterEl.style.backgroundColor = '#7f8c8d';
            letterEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            letterEl.style.color = '#fff';
            letterEl.style.border = 'none';
        } else {
            letterEl.style.backgroundColor = '#e67e22'; // Revert text element back to original base orange
        }
    }

    // Build the string representation to pass on to the submission field
    const currentLetters = Array.from(targetBox.querySelectorAll('span:not(#placeholder-' + realIndex + ')'))
                                .map(el => el.getAttribute('data-letter'));
    hiddenInput.value = currentLetters.join('');

    // Restore contextual text helper if user clears the board
    if (currentLetters.length === 0 && placeholder) {
        placeholder.style.display = 'block';
    }
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
                   style="border:none; border-radius: 5px; border-bottom:2px solid #007bff; width:auto; text-align:center; background: #fffdec; font-size:1em; font-weight:bold;"> ${parts[1] || ""}</p>
            <div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px; font-size:0.9em;"></div>`;
    } 
    else if (q.type === "SPELLING") {
        qDiv.innerHTML = `
            <p><strong>${displayNum}. Spell the word for:</strong> <br>
            <span style="color:#007bff; font-size:1.1em; font-weight:bold; display:block; margin: 10px 0;">"${q.hint}"</span></p>
            <input type="text" id="spelling-${realIndex}" 
                   placeholder="Type the correct spelling..."
                   style="border:none; border-bottom:2px solid #28a745; width:220px; text-align:center; background: #f0fff4; font-size:1em; font-weight:bold; outline:none; padding:5px;">
            <div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px; font-size:0.9em;"></div>`;
    }
    // Interactive, dynamic click block grid implementation for SCRAMBLE questions (Adjusted for spaces)
    else if (q.type === "SCRAMBLE") {
        const scrambledText = scrambleWordPhrase(q.correctAnswer);
        const letterArray = scrambledText.split(''); 

        qDiv.innerHTML = `
            <p><strong>${displayNum}. Arrange the scrambled letters correctly:</strong> <br>
            <span style="font-size:0.85em; color:#555; display:block; margin-bottom:5px;">Hint: ${q.hint}</span></p>
            
            <div id="scramble-target-${realIndex}" style="display: flex; gap: 8px; flex-wrap: wrap; min-height: 45px; padding: 10px; border: 2px dashed #e67e22; border-radius: 8px; background: #fffdf9; margin-bottom: 12px; align-items: center;">
                <span style="color: #aaa; font-style: italic; font-size: 0.9em;" id="placeholder-${realIndex}">Click letters/spaces below to arrange...</span>
            </div>

            <div id="scramble-pool-${realIndex}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
             ${letterArray.map((letter) => {
            const isSpace = letter === ' ';
            const displayChar = isSpace ? 'space' : letter;
            const bgColor = isSpace ? '#7f8c8d' : '#e67e22';
            
            // Dynamically set width: 60px for spaces, 35px for letters
            const blockWidth = isSpace ? '60px' : '35px';

            return `
                <span onclick="handleScrambleLetterClick(this, ${realIndex})" 
                    data-letter="${letter}" 
                    style="display: inline-flex; align-items: center; justify-content: center; width: ${blockWidth}; height: 35px; font-size: 1.1em; font-weight: bold; color: #fff; background-color: ${bgColor}; border-radius: 6px; cursor: pointer; user-select: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.1s;">${displayChar}</span>
            `;
            }).join('')}
             </div>
                
            <input type="hidden" id="scramble-${realIndex}" value="">
            <div id="fb-${realIndex}" style="font-weight:bold; margin-top:5px; font-size:0.9em;"></div>`;
    }
    else if (q.type === "MATCHING") {
        qDiv.innerHTML = `
            <div class="line-quiz-container" id="line-quiz-${realIndex}">
                <svg class="line-quiz-svg" id="svg-${realIndex}"></svg>
                
                <div class="line-quiz-column line-quiz-column-left">
                    <div class="line-quiz-item">
                        <span><strong>${displayNum}.</strong> ${q.term}</span>
                        <div class="quiz-anchor-dot source-dot" data-idx="${realIndex}" data-val="${q.term}"></div>
                    </div>
                </div>

                <div class="line-quiz-column line-quiz-column-right">
                    ${shuffledDefs.map(d => `
                        <div class="line-quiz-item">
                            <div class="quiz-anchor-dot target-dot" data-idx="${realIndex}" data-val="${d}"></div>
                            <span>${d}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <input type="hidden" id="match-${realIndex}" value="">
            <div id="fb-${realIndex}" style="font-weight:bold; font-size:0.9em; text-align: right; margin-top:5px;"></div>
        `;

        setTimeout(() => connectQuizThreads(realIndex), 50);
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

function addSectionControls(container, idx) {
    const div = document.createElement("div");
    div.style.cssText = "text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;";
    div.innerHTML = `
        <button onclick="submitSection(${idx})" style="padding:10px 25px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Submit Results</button>
        <button onclick="resetSection(${idx})" style="padding:10px 25px; background:#6c757d; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">Reset</button>
        <div id="score-${idx}" style="margin-top:20px; padding:15px; border-radius:10px; display:none;"></div>`;
    container.lastChild.appendChild(div);
}

// ================= 5. SUBMIT WITH GRADING =================
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
        const scramble = section.querySelector(`#scramble-${idx}`);

        if (spelling) {
            total++;
            if (spelling.value.toLowerCase().trim() === q.correctAnswer) {
                score++; fb.innerHTML="✓ Correct! ✨"; fb.style.color="#28a745";
            } else {
                fb.innerHTML=`Incorrect. Correct spelling: "${q.correctAnswer}"`; fb.style.color="#dc3545";
            }
        }
        else if (scramble) {
            total++;
            if (scramble.value.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
                score++; fb.innerHTML="✓ Correct! ✨"; fb.style.color="#28a745";
            } else {
                fb.innerHTML=`Incorrect. The correct phrase is: "${q.correctAnswer}"`; fb.style.color="#dc3545";
            }
        }
        else if (blank) {
            total++;
            if (blank.value.toLowerCase().trim() === q.correctAnswer) { 
                score++; fb.innerHTML="✓ Correct! ✨"; fb.style.color="#28a745"; 
            } else { 
                fb.innerHTML=`The correct answer is "${q.correctAnswer}"`; fb.style.color="#dc3545"; 
            }
        } else if (match) {
            total++;
            if (match.value === q.definition) { 
                score++; fb.innerHTML="✓ Correct ✨"; fb.style.color="#28a745"; 
            } else { 
                fb.innerHTML=`The correct answer is "${q.definition}"`; fb.style.color="#dc3545"; 
            }
        } else if (radio) {
            total++;
            const sel = section.querySelector(`input[name="question${idx}"]:checked`);
            const isCorrect = sel && parseInt(sel.value) === q.correct;
            
            if (isCorrect) { 
                score++; fb.innerHTML="✓ Correct! ✨"; fb.style.color="#28a745";
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
    
    // Custom structural reset processing for the interactive block workspace (Restoring baseline styling configurations)
    section.querySelectorAll('[id^="scramble-target-"]').forEach(target => {
        const realIndex = target.id.split('-').pop();
        const pool = section.querySelector(`#scramble-pool-${realIndex}`);
        const hiddenInput = section.querySelector(`#scramble-${realIndex}`);
        const placeholder = section.querySelector(`#placeholder-${realIndex}`);
        
        if (pool && hiddenInput) {
            const letters = target.querySelectorAll('span:not([id^="placeholder-"])');
            letters.forEach(letter => {
                const isSpace = letter.getAttribute('data-letter') === ' ';
                
                // Fully reset visual structures back to their base pool styling profiles
                letter.style.color = '#fff';
                letter.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                letter.style.border = 'none';
                letter.style.backgroundColor = isSpace ? '#7f8c8d' : '#e67e22';
                
                pool.appendChild(letter);
            });
            hiddenInput.value = "";
            if (placeholder) placeholder.style.display = 'block';
        }
    });

    // Custom structural reset for line connection containers
    section.querySelectorAll('.line-quiz-container').forEach(container => {
        const index = container.id.split('-').pop();
        savedThreadLinks[index] = null;
        container.querySelectorAll('.quiz-anchor-dot').forEach(dot => {
            dot.classList.remove('linked', 'active-link');
        });
        const svg = container.querySelector('.line-quiz-svg');
        if (svg) svg.innerHTML = '';
    });

    const scoreDiv = document.getElementById(`score-${sIdx}`);
    if (scoreDiv) scoreDiv.style.display = "none";
}



// ================= 6. TRUE REAL-TIME CRUD ENGINE =================
const NOTES_API_URL = "https://script.google.com/macros/s/AKfycbwhn8Y4LozU2a8Kd-mPpBb_bQ6k3cQwtzdZ-5UhDVn6Xl66sXWeFldF65iNC1H_ek_H/exec";
const noteArea = document.getElementById('sticky-notes');
const saveStatus = document.getElementById('save-status');

// A global window handler to catch Google's JSONP confirmation response bypasses CORS rules
window.logCloudStatus = function(data) {
    if (data && data.status === "success") {
        if (saveStatus) saveStatus.innerText = "Synced with Spreadsheet ✅";
    }
    // Clean up our temporary script connection channel
    document.getElementById('cloud-transport')?.remove();
};

// 1. READ (Fetches from Cell A1 automatically when the page opens)
async function loadNoteFromSheet() {
    if (!noteArea) return;
    try {
        if (saveStatus) saveStatus.innerText = "Loading cloud notes...";
        // Cache bust using Date.now() ensures Google doesn't send old text
        const response = await fetch(`${NOTES_API_URL}?_cb=${Date.now()}`);
        const data = await response.text();
        
        // If the sheet returns our fallback error text or no data, keep text area clean
        if (data === "No parameters found.") {
            noteArea.value = "";
        } else {
            noteArea.value = data;
        }
        
        if (saveStatus) saveStatus.innerText = "Notes synced";
    } catch (err) { 
        console.error("Load failed:", err); 
        if (saveStatus) saveStatus.innerText = "Load error ❌";
    }
}

// 2. UPDATE (Real-time Cloud Write to Cell A1)
function saveNoteToSheet() {
    if (!noteArea) return;
    if (saveStatus) saveStatus.innerText = "Syncing to spreadsheet...";
    
    // Clear any previous transport elements out of the DOM 
    document.getElementById('cloud-transport')?.remove();

    // Dynamically inject a script tag to achieve a 100% CORS-proof background push
    const script = document.createElement('script');
    script.id = 'cloud-transport';
    script.src = `${NOTES_API_URL}?action=update&note=${encodeURIComponent(noteArea.value)}&callback=logCloudStatus&_cb=${Date.now()}`;
    document.body.appendChild(script);
}

// 3. DELETE (Real-time Cloud Wipe of Cell A1)
function deleteNoteFromSheet() {
    if (!confirm("Wipe this note from the spreadsheet database?")) return;
    if (saveStatus) saveStatus.innerText = "Clearing row...";
    
    document.getElementById('cloud-transport')?.remove();

    const script = document.createElement('script');
    script.id = 'cloud-transport';
    script.src = `${NOTES_API_URL}?action=delete&callback=logCloudStatus&_cb=${Date.now()}`;
    document.body.appendChild(script);
    
    noteArea.value = "";
}

// Attach action handlers to your exact index.html layout button IDs
document.getElementById('save-note')?.addEventListener('click', saveNoteToSheet);
document.getElementById('delete-note')?.addEventListener('click', deleteNoteFromSheet);

// True Real-Time CRUD Listener
// This listens to EVERY SINGLE KEYSTROKE you input.
// It waits exactly 400 milliseconds after you stop typing a character to save, preventing network spam.
let typingTimer = null;
noteArea?.addEventListener('input', () => {
    if (saveStatus) saveStatus.innerText = "Typing...";
    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveNoteToSheet, 400); 
});

// Run the data load function immediately when the browser finishes unpacking the layout
window.addEventListener('DOMContentLoaded', loadNoteFromSheet);



// ================= INITIALIZATION =================
function loadVoices() { voices = speechSynthesis.getVoices().filter(v => v.lang.includes('en')); }
speechSynthesis.onvoiceschanged = loadVoices;
window.onload = loadData;

function updatePHTime() {
    const timeElement = document.getElementById('ph-time');
    const dateElement = document.getElementById('ph-date');
    const now = new Date();
    const timeOptions = { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const dateOptions = { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if(timeElement) timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
    if(dateElement) dateElement.textContent = now.toLocaleDateString('en-US', dateOptions).toUpperCase();
}

setInterval(updatePHTime, 1000);
updatePHTime();

// ================= 7. THEME SETTINGS (DARK/LIGHT TOGGLE) =================
function initializeTheme() {
    const settingsLink = document.getElementById('settings-link');

    function updateThemeUI(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        if (settingsLink) {
            const icon = settingsLink.querySelector('i');
            if (icon) {
                if (isDark) {
                    icon.className = 'fa-solid fa-sun';
                    if (settingsLink.lastChild && settingsLink.lastChild.nodeType === 3) {
                        settingsLink.lastChild.textContent = ' Light Mode';
                    }
                } else {
                    icon.className = 'fa-solid fa-moon';
                    if (settingsLink.lastChild && settingsLink.lastChild.nodeType === 3) {
                        settingsLink.lastChild.textContent = ' Dark Mode';
                    }
                }
            }
        }
    }

    const savedTheme = localStorage.getItem('dashboard-theme') || 'light';
    updateThemeUI(savedTheme === 'dark');

    if (settingsLink) {
        settingsLink.onclick = function(e) {
            e.preventDefault();
            const isNowDark = !document.body.classList.contains('dark-mode');
            localStorage.setItem('dashboard-theme', isNowDark ? 'dark' : 'light');
            updateThemeUI(isNowDark);
        };
    }
}

initializeTheme();


// ================= 8. MATCHING QUESTION LINE WRAPPER ENGINE =================
let drawingAnchor = null;
let savedThreadLinks = {}; 

function connectQuizThreads(index) {
    const space = document.getElementById(`line-quiz-${index}`);
    const svgLayer = document.getElementById(`svg-${index}`);
    const hiddenInput = document.getElementById(`match-${index}`);
    if (!space || !svgLayer) return;

    let activeLine = null;

    function refreshThreadLines() {
        svgLayer.innerHTML = '';
        const spaceRect = space.getBoundingClientRect();

        if (savedThreadLinks[index]) {
            const link = savedThreadLinks[index];
            const p1 = getAnchorCenter(link.sourceEl, spaceRect);
            const p2 = getAnchorCenter(link.targetEl, spaceRect);
            appendSvgLine(p1.x, p1.y, p2.x, p2.y, '#28a745');
        }
    }

    function appendSvgLine(x1, y1, x2, y2, color) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        svgLayer.appendChild(line);
        return line;
    }

    function getAnchorCenter(element, parentRect) {
        const elRect = element.getBoundingClientRect();
        return {
            x: (elRect.left + elRect.width / 2) - parentRect.left,
            y: (elRect.top + elRect.height / 2) - parentRect.top
        };
    }

    space.addEventListener('mousedown', function(e) {
        const targetDot = e.target;
        if (!targetDot.classList.contains('source-dot') || targetDot.getAttribute('data-idx') != index) return;

        e.preventDefault();
        drawingAnchor = targetDot;
        targetDot.classList.add('active-link');

        if (savedThreadLinks[index]) {
            savedThreadLinks[index].targetEl.classList.remove('linked');
            savedThreadLinks[index] = null;
            hiddenInput.value = '';
        }
        refreshThreadLines();

        const spaceRect = space.getBoundingClientRect();
        const startPt = getAnchorCenter(drawingAnchor, spaceRect);
        activeLine = appendSvgLine(startPt.x, startPt.y, startPt.x, startPt.y, '#007bff');
    });

    document.addEventListener('mousemove', function(e) {
        if (!drawingAnchor || drawingAnchor.getAttribute('data-idx') != index || !activeLine) return;

        const spaceRect = space.getBoundingClientRect();
        const currentX = e.clientX - spaceRect.left;
        const currentY = e.clientY - spaceRect.top;

        activeLine.setAttribute('x2', currentX);
        activeLine.setAttribute('y2', currentY);
    });

    document.addEventListener('mouseup', function(e) {
        if (!drawingAnchor || drawingAnchor.getAttribute('data-idx') != index) return;

        const releaseDot = e.target;

        if (releaseDot.classList.contains('target-dot') && releaseDot.getAttribute('data-idx') == index) {
            savedThreadLinks[index] = {
                sourceEl: drawingAnchor,
                targetEl: releaseDot,
                choiceVal: releaseDot.getAttribute('data-val')
            };

            drawingAnchor.classList.add('linked');
            releaseDot.classList.add('linked');
            hiddenInput.value = releaseDot.getAttribute('data-val');
        }

        drawingAnchor.classList.remove('active-link');
        drawingAnchor = null;
        activeLine = null;
        refreshThreadLines();
    });

    window.addEventListener('resize', refreshThreadLines);
    setTimeout(refreshThreadLines, 100);
}
