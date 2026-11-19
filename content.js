let activeElement = null;

// --- ئۇيغۇرچىنى ئوقۇش ئۈچۈن خەرپ ئالماشتۇرۇش جەدۋىلى ---
const UY_TO_ULY_MAP = {'ا':'a','ە':'e','ب':'b','پ':'p','ت':'t','ج':'j','چ':'ch','خ':'x','د':'d','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','غ':'gh','ف':'f','ق':'q','ك':'k','گ':'g','ڭ':'ng','ل':'l','م':'m','ن':'n','ھ':'h','و':'o','ۇ':'u','ۆ':'o','ۈ':'u','ي':'y','ۋ':'v','ې':'e','ى':'i','ئ':'','؟':'?'};
const UY_TO_ULY_MAPT = {'ا':'a','ە':'e','ب':'b','پ':'p','ت':'t','ج':'c','چ':'ç','خ':'hh','د':'d','ر':'r','ز':'z','ژ':'j','س':'s','ش':'ş','غ':'gh','f':'f','ق':'k','ك':'k','گ':'g','ڭ':'n','ل':'l','م':'m','ن':'n','ھ':'h','و':'o','ۇ':'u','ۆ':'ö','ۈ':'ü','ي':'y','ۋ':'v','ې':'e','ى':'i','ئ':'','؟':'?'};

function convertForTTS(text, map) {
    return text.split('').map(c => map[c] || c).join('');
}

let chunks = [];
let chunkIndex = 0;
let isReading = false;
let currentVolume = 1.0;

// --- زىكىر ئەسلەتمىسى سانلىق مەلۇماتلىرى ---
const ZIKIR_LIST = [
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
    "لَا إِلَهَ إِلَّا اللَّهُ",
    "أَسْتَغْفِرُ اللَّهَ",
    "اللَّهُ أَكْبَرُ",
    "اللَّهُمَّ اغْفِرْ لَنَا وَارْحَمْنَا وَلِوَالِدَيْنَا",
    "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا",
    "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    "اللَّهُمَّ آتِنِي الْحِكْمَةَ الَّتِي مَنْ أُوتِيَهَا فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا",
    "رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا"
];

let zikirEnabled = true;
let zikirMinutes = 7;
let zikirIndex = 0;
let zikirRemainingSeconds = 7 * 60;
let zikirIntervalId = null;
let zikirAudio = null;

// نۆۋەتتىكى تەڭشەكلەرنى ساقلايدىغان ئوبيېكت
const DEFAULT_SETTINGS = {
    font: "'UKIJ Tuz', 'Alkatip', sans-serif",
    size: 18,
    lineHeight: 1.6,
    direction: 'rtl',
    align: 'justify'
};

let currentSettings = { ...DEFAULT_SETTINGS };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "formatText") {
    formatSelectedText();
    showControlPanel();
  }
});

// AI Studio قاتارلىق بەتلەردە خەت شەكلىنى مەجبۇرىي ئۆزگەرتىش ئۈچۈن ھەرىكەتچان Style قوشۇش
function updateStyleTag() {
    if (activeElement && !activeElement.classList.contains('uyghur-formatted-text')) {
        activeElement.classList.add('uyghur-formatted-text');
    }
    let styleEl = document.getElementById('uyg-custom-dynamic-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'uyg-custom-dynamic-style';
        document.head.appendChild(styleEl);
    }
    
    // ".uyghur-formatted-text" كلاسسىغا ئىگە ئېلېمېنت ۋە ئۇنىڭ ئىچىدىكى بارلىق بالىلىرىغا (!important) بىلەن تېڭىش
    styleEl.textContent = `
        .uyghur-formatted-text, .uyghur-formatted-text * {
            font-family: ${currentSettings.font} !important;
            font-size: ${currentSettings.size}px !important;
            line-height: ${currentSettings.lineHeight} !important;
            direction: ${currentSettings.direction} !important;
            text-align: ${currentSettings.align} !important;
        }
        .uyghur-formatted-text {
            text-indent: 2em !important;
        }
    `;
}

function formatSelectedText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  let element = range.commonAncestorContainer;

  if (element.nodeType === 3) { 
    element = element.parentElement;
  }
  
  while (element && element !== document.body && window.getComputedStyle(element).display.includes('inline')) {
      element = element.parentElement;
  }

  if (element) {
    activeElement = element;
    
    // ئۆزگىچە كلاس قوشۇش ئارقىلىق CSS سىستېمىسىنى تونۇتۇش
    activeElement.classList.add('uyghur-formatted-text');
    updateStyleTag();
  }
}

function resetFormatting() {
  document.querySelectorAll('.uyghur-formatted-text').forEach((el) => {
    el.classList.remove('uyghur-formatted-text');
  });
  const styleEl = document.getElementById('uyg-custom-dynamic-style');
  if (styleEl) {
    styleEl.remove();
  }
  currentSettings = { ...DEFAULT_SETTINGS };
  const fontSelect = document.getElementById('uyg-font-select');
  if (fontSelect) {
    fontSelect.value = currentSettings.font;
  }
}

// --- ئەلا سۈپەتلىك ئاۋاز تېپىش لوگىكىسى ---
function getBestVoice(langPrefix) {
    const voices = window.speechSynthesis.getVoices();
    let filtered = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    
    if (filtered.length === 0) return null;

    let bestVoice = filtered.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Online') || 
        v.name.includes('Premium') || 
        v.name.includes('Google')
    );

    return bestVoice || filtered[0]; 
}

// --- ئاۋازلىق ئوقۇش لوگىكىسى ---
function startReading() {
    stopReading();
    if (!activeElement) return;

    isReading = true;
    let fullText = activeElement.innerText;

    let rawChunks = fullText.split(/[\n。！？.!?]+/);
    chunks = [];
    for (let i = 0; i < rawChunks.length; i++) {
        let clean = rawChunks[i].trim();
        if (clean.length > 0) chunks.push(clean);
    }

    chunkIndex = 0;
    speakNextChunk();
}

function speakNextChunk() {
    if (!isReading) return;
    if (chunkIndex >= chunks.length) {
        isReading = false;
        return;
    }

    const voiceVal = document.getElementById('uyg-voice-select').value;
    const rateVal = parseFloat(document.getElementById('uyg-rate-select').value);
    let chunkText = chunks[chunkIndex];
    let finalText = chunkText;

    if(voiceVal === 'ug-UG0') finalText = convertForTTS(chunkText, UY_TO_ULY_MAPT);
    else if (voiceVal === 'ug-UG') finalText = convertForTTS(chunkText, UY_TO_ULY_MAP);

    const utterance = new SpeechSynthesisUtterance(finalText);
    const voices = window.speechSynthesis.getVoices();
    let chosenVoice = null;
    
    if(voiceVal === 'ug-UG0') {
        chosenVoice = getBestVoice('tr'); 
    } else if (voiceVal === 'ug-UG') {
        chosenVoice = voices.find(v => v.lang.includes('uz') && v.name.includes('Madina')) || getBestVoice('tr');
    } else {
        chosenVoice = getBestVoice(voiceVal); 
    }

    if(chosenVoice) utterance.voice = chosenVoice;
    utterance.rate = rateVal;
    utterance.volume = currentVolume;

    utterance.onend = function() {
        if (isReading) {
            chunkIndex++;
            speakNextChunk();
        }
    };
    utterance.onerror = function() { if (isReading) { chunkIndex++; speakNextChunk(); } };

    window.speechSynthesis.speak(utterance);
}

function nextChunk() {
    if (!isReading || chunks.length === 0) return;
    window.speechSynthesis.cancel();
}

function prevChunk() {
    if (!isReading || chunks.length === 0) return;
    if (chunkIndex > 0) {
        chunkIndex -= 2; 
        if (chunkIndex < -1) chunkIndex = -1;
        window.speechSynthesis.cancel();
    }
}

function stopReading() { 
    isReading = false;
    window.speechSynthesis.cancel(); 
}

function stopZikirAudio() {
    if (zikirAudio) {
        zikirAudio.pause();
        zikirAudio.currentTime = 0;
        zikirAudio = null;
    }
}

function prewarmNextZikirMp3(index) {
    fetch(`/api/zikir/prepare/${index}`, { method: 'POST' }).catch(() => {});
}

async function speakZikir(forcePlay = false) {
    if (!zikirEnabled && !forcePlay) return;
    if (!forcePlay && isReading && window.speechSynthesis.speaking) return;

    const currentIdx = zikirIndex;
    const text = ZIKIR_LIST[currentIdx];
    zikirIndex = (zikirIndex + 1) % ZIKIR_LIST.length;

    const textEl = document.getElementById('uyg-zikir-text');
    const mp3InfoEl = document.getElementById('uyg-zikir-mp3-info');
    const statusEl = document.getElementById('uyg-zikir-status');

    if (textEl) {
        textEl.textContent = text;
        textEl.style.display = 'block';
    }
    if (statusEl) {
        statusEl.textContent = `MP3 تەييارلىنىۋاتىدۇ (zikir-${currentIdx + 1}.mp3)...`;
    }

    try {
        const res = await fetch(`/api/zikir/prepare/${currentIdx}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.error || 'MP3 تەييارلاش مەغلۇپ بولدى');
        }

        if (mp3InfoEl) {
            mp3InfoEl.innerHTML = '';
            const labelSpan = document.createElement('span');
            labelSpan.textContent = `ساقلاندى: ${data.filename} `;
            const dlLink = document.createElement('a');
            dlLink.href = `${data.url}?download=1`;
            dlLink.download = data.filename;
            dlLink.textContent = 'چۈشۈرۈش';
            dlLink.style.cssText = 'color:#0369a1; text-decoration:underline; font-weight:bold;';
            mp3InfoEl.appendChild(labelSpan);
            mp3InfoEl.appendChild(dlLink);
            mp3InfoEl.style.display = 'block';
        }

        stopZikirAudio();
        zikirAudio = new Audio(data.url);
        zikirAudio.volume = currentVolume;
        zikirAudio.onended = () => {
            updateZikirUI();
        };
        await zikirAudio.play();
        if (statusEl) {
            statusEl.textContent = `ئوقۇلۇۋاتىدۇ: ${data.filename}`;
        }
        prewarmNextZikirMp3(zikirIndex);
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = `خاتالىق: ${err?.message || 'ئاۋاز قويۇش مەغلۇپ بولدى'}`;
        }
    }
}

function updateZikirUI() {
    const toggleBtn = document.getElementById('uyg-zikir-toggle');
    const statusEl = document.getElementById('uyg-zikir-status');
    if (toggleBtn) {
        if (zikirEnabled) {
            toggleBtn.textContent = 'زىكىر: ئوچۇق';
            toggleBtn.style.background = '#dcfce7';
            toggleBtn.style.color = '#166534';
        } else {
            toggleBtn.textContent = 'زىكىر: تاقاق';
            toggleBtn.style.background = '#e2e8f0';
            toggleBtn.style.color = '#475569';
        }
    }
    if (statusEl) {
        if (!zikirEnabled) {
            statusEl.textContent = 'زىكىر ئەسلەتمىسى تاقالدى';
        } else {
            const mins = Math.floor(zikirRemainingSeconds / 60);
            const secs = String(zikirRemainingSeconds % 60).padStart(2, '0');
            statusEl.textContent = `كېيىنكى زىكىر: ${mins}:${secs}`;
        }
    }
}

function stopZikirTimer() {
    if (zikirIntervalId) {
        clearInterval(zikirIntervalId);
        zikirIntervalId = null;
    }
}

function startZikirTimer() {
    stopZikirTimer();
    if (!zikirEnabled) {
        updateZikirUI();
        return;
    }
    zikirRemainingSeconds = zikirMinutes * 60;
    updateZikirUI();
    zikirIntervalId = setInterval(() => {
        if (!zikirEnabled) {
            stopZikirTimer();
            return;
        }
        zikirRemainingSeconds -= 1;
        if (zikirRemainingSeconds <= 0) {
            speakZikir();
            zikirRemainingSeconds = zikirMinutes * 60;
        }
        updateZikirUI();
    }, 1000);
}

// --- كۆزنەك چىقىرىش ---
function showControlPanel() {
  if (document.getElementById('uyg-pro-wrapper')) {
      // ئەگەر كۆزنەك ئاللىبۇرۇن بولسا، يوشۇرۇنغان بولسا ئېچىۋېتىدۇ
      document.getElementById('uyg-pro-panel').style.display = 'block';
      document.getElementById('uyg-toggle-icon').style.display = 'none';
      return;
  }

  // ئاساسلىق ئورالما
  const wrapper = document.createElement('div');
  wrapper.id = 'uyg-pro-wrapper';
  wrapper.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 999999;`;

  // كىچىكلىتىلگەندە كۆرۈنىدىغان ئايكون
  const toggleIcon = document.createElement('div');
  toggleIcon.id = 'uyg-toggle-icon';
  toggleIcon.innerHTML = '⚙️ بىلىك';
  toggleIcon.style.cssText = `
    display: none; cursor: pointer; background: #2563eb; color: white;
    padding: 8px 15px; border-radius: 20px; font-family: 'UKIJ Tuz', sans-serif;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2); font-weight: bold; font-size: 14px;
    border: 2px solid white; transition: background 0.2s;
  `;
  toggleIcon.onmouseover = () => toggleIcon.style.background = '#1d4ed8';
  toggleIcon.onmouseout = () => toggleIcon.style.background = '#2563eb';

  // ئاساسىي كۆزنەك
  const panel = document.createElement('div');
  panel.id = 'uyg-pro-panel';
  
  panel.style.cssText = `
    background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px;
    padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-family: 'UKIJ Tuz', sans-serif; direction: rtl; text-align: right;
    width: 290px; color: #1e293b; transition: all 0.3s ease;
  `;

  const btnStyle = "flex:1; padding:5px; background:#e2e8f0; border:none; border-radius:4px; cursor:pointer; font-family:inherit;";

  panel.innerHTML = `
    <div style="display:flex; justify-content: space-between; align-items:center; border-bottom: 2px solid #3b82f6; margin-bottom: 10px; padding-bottom: 5px;">
        <span style="font-weight: bold; font-size:16px; color:#1d4ed8;">تەھرىرلەش ۋە ئوقۇش</span>
        <button id="uyg-panel-minimize" style="background:none; border:none; font-size:16px; cursor:pointer; color:#64748b; padding:0;" title="يوشۇرۇش">➖</button>
    </div>
    
    <!-- 1. خەت تەڭشىكى -->
    <select id="uyg-font-select" style="width:100%; padding:6px; margin-bottom:10px; border-radius:6px; border:1px solid #ccc; font-family:inherit;">
      <option value="'UKIJ Tuz', sans-serif">خەت: UKIJ Tuz</option>
      <option value="'Alkatip', sans-serif">خەت: Alkatip</option>
      <option value="'Microsoft Uighur', sans-serif">خەت: Microsoft Uighur</option>
      <option value="'Alkatip Tor', sans-serif">خەت: Alkatip Tor</option>
      <option value="'UKIJ Zilwa', sans-serif">خەت: UKIJ Zilwa</option>
      <option value="'Calibri', sans-serif">خەت: Calibri</option>
      <option value="'Arabic Typesetting', serif">خەت: Arabic Typesetting</option>
    </select>

    <div style="display:flex; justify-content: space-between; margin-bottom: 10px; gap:5px;">
      <button id="uyg-size-down" style="${btnStyle}">خەت -</button>
      <button id="uyg-size-up" style="${btnStyle}">خەت +</button>
      <button id="uyg-line-down" style="${btnStyle}">قۇر -</button>
      <button id="uyg-line-up" style="${btnStyle}">قۇر +</button>
    </div>

    <!-- 2. يۆنىلىش ۋە توغرىلاش -->
    <div style="display:flex; justify-content: space-between; margin-bottom: 5px; gap:5px;">
      <button id="uyg-dir-rtl" style="${btnStyle}; background:#dbeafe; color:#1e40af;">ئوڭدىن ◂</button>
      <button id="uyg-dir-ltr" style="${btnStyle}">سولدىن ▸</button>
    </div>
    <div style="display:flex; justify-content: space-between; margin-bottom: 10px; gap:5px;">
      <button id="uyg-align-justify" style="${btnStyle}; background:#dcfce7; color:#166534;">تەكشى توغرىلاش</button>
      <button id="uyg-align-normal" style="${btnStyle}">ئادەتتىكى</button>
    </div>
    <button id="uyg-reset-format" style="width:100%; padding:6px; margin-bottom: 12px; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold;">ئەسلى ھالەتكە قايتۇرۇش</button>

    <div style="border-top: 1px dashed #cbd5e1; margin-bottom: 10px;"></div>

    <!-- 3. ئاۋازلىق ئوقۇش تەڭشەكلىرى -->
    <div style="display:flex; gap:5px; margin-bottom:10px;">
        <select id="uyg-voice-select" style="flex:2; padding:6px; border-radius:6px; border:1px solid #ccc; font-family:inherit; direction:ltr;">
            <option value="ug-UG0">Uyghur (Er)</option>
            <option value="ug-UG">Uyghur (Ayal)</option>
            <option value="ar">العربية (Arabic)</option>
            <option value="en">English (Premium)</option>
            <option value="zh">中文 (Chinese)</option>
            <option value="tr">Türkçe (Natural)</option>
        </select>
        <select id="uyg-rate-select" style="flex:1; padding:6px; border-radius:6px; border:1px solid #ccc; direction:ltr;">
            <option value="1.0">1.0x</option>
            <option value="1.5" selected>1.5x</option>
            <option value="2.0">2.0x</option>
        </select>
    </div>

    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:12px;">
        <span>ئاۋاز:</span>
        <input id="uyg-volume-range" type="range" min="0" max="1" step="0.1" value="1" style="flex:1; cursor:pointer;" />
        <span id="uyg-volume-label" style="min-width:34px; direction:ltr; text-align:left;">100%</span>
    </div>

    <!-- كونترول كۇنۇپكىلىرى -->
    <div style="display:flex; justify-content: space-between; margin-bottom: 12px; gap:4px; direction:ltr;">
        <button id="btn-prev" style="flex:1; padding:8px; background:#64748b; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">⏮</button>
        <button id="btn-play" style="flex:1; padding:8px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">▶</button>
        <button id="btn-next" style="flex:1; padding:8px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">⏭</button>
        <button id="btn-stop" style="flex:1; padding:8px; background:#e11d48; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">■</button>
    </div>

    <div style="border-top: 1px dashed #cbd5e1; margin-bottom: 10px;"></div>

    <!-- 4. زىكىر ئەسلەتمىسى -->
    <div style="margin-bottom: 12px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <button id="uyg-zikir-toggle" style="${btnStyle}; font-weight:bold;">زىكىر: ئوچۇق</button>
            <button id="uyg-zikir-play-now" title="ھازىر ئوقۇش" style="padding:5px 10px; background:#0f766e; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">▶</button>
            <label style="display:flex; align-items:center; gap:4px; font-size:12px;">
                <span>مىنۇت:</span>
                <input id="uyg-zikir-minutes" type="number" min="1" max="180" value="7" style="width:48px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; direction:ltr;" />
            </label>
        </div>
        <div id="uyg-zikir-status" style="font-size:12px; color:#475569; margin-bottom:4px;">كېيىنكى زىكىر: 7:00</div>
        <div id="uyg-zikir-text" style="display:none; font-size:14px; color:#0f766e; background:#f0fdfa; border:1px solid #99f6e4; border-radius:6px; padding:6px 8px; line-height:1.6; margin-bottom:4px;"></div>
        <div id="uyg-zikir-mp3-info" style="display:none; font-size:11px; color:#475569; direction:rtl;"></div>
    </div>
    
    <button id="uyg-panel-close" style="width:100%; padding:8px; background:#333; color:white; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold;">ئۈزۈل-كېسىل تاقاش</button>
  `;

  wrapper.appendChild(toggleIcon);
  wrapper.appendChild(panel);
  document.body.appendChild(wrapper);

  // --- ھادىسىلەرنى تىزىملاش ---

  // كىچىكلىتىش ۋە چوڭايتىش
  document.getElementById('uyg-panel-minimize').addEventListener('click', () => {
      panel.style.display = 'none';
      toggleIcon.style.display = 'block';
  });

  toggleIcon.addEventListener('click', () => {
      toggleIcon.style.display = 'none';
      panel.style.display = 'block';
  });
  
  // 1. خەت ۋە قۇر
  document.getElementById('uyg-font-select').addEventListener('change', (e) => {
      currentSettings.font = e.target.value;
      updateStyleTag();
  });

  document.getElementById('uyg-size-up').addEventListener('click', () => { 
      currentSettings.size += 2; 
      updateStyleTag(); 
  });
  document.getElementById('uyg-size-down').addEventListener('click', () => { 
      currentSettings.size -= 2; 
      updateStyleTag(); 
  });

  document.getElementById('uyg-line-up').addEventListener('click', () => { 
      currentSettings.lineHeight += 0.2; 
      updateStyleTag(); 
  });
  document.getElementById('uyg-line-down').addEventListener('click', () => { 
      currentSettings.lineHeight -= 0.2; 
      updateStyleTag(); 
  });

  // 2. يۆنىلىش ۋە توغرىلاش
  document.getElementById('uyg-dir-rtl').addEventListener('click', () => { 
      currentSettings.direction = 'rtl';
      currentSettings.align = 'right';
      updateStyleTag();
  });
  document.getElementById('uyg-dir-ltr').addEventListener('click', () => { 
      currentSettings.direction = 'ltr';
      currentSettings.align = 'left';
      updateStyleTag();
  });

  document.getElementById('uyg-align-justify').addEventListener('click', () => { 
      currentSettings.align = 'justify';
      updateStyleTag();
  });
  document.getElementById('uyg-align-normal').addEventListener('click', () => { 
      currentSettings.align = currentSettings.direction === 'rtl' ? 'right' : 'left';
      updateStyleTag();
  });

  document.getElementById('uyg-reset-format').addEventListener('click', resetFormatting);

  // 3. ئوقۇش
  document.getElementById('uyg-volume-range').addEventListener('input', (e) => {
      currentVolume = parseFloat(e.target.value);
      document.getElementById('uyg-volume-label').textContent = Math.round(currentVolume * 100) + '%';
      if (zikirAudio) {
          zikirAudio.volume = currentVolume;
      }
  });

  document.getElementById('btn-play').addEventListener('click', startReading);
  document.getElementById('btn-next').addEventListener('click', nextChunk);
  document.getElementById('btn-prev').addEventListener('click', prevChunk);
  document.getElementById('btn-stop').addEventListener('click', stopReading);

  // 4. زىكىر ئەسلەتمىسى
  document.getElementById('uyg-zikir-toggle').addEventListener('click', () => {
      zikirEnabled = !zikirEnabled;
      if (zikirEnabled) {
          startZikirTimer();
      } else {
          stopZikirTimer();
          stopZikirAudio();
          updateZikirUI();
      }
  });

  document.getElementById('uyg-zikir-play-now').addEventListener('click', () => {
      speakZikir(true);
  });

  document.getElementById('uyg-zikir-minutes').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      zikirMinutes = Number.isFinite(val) && val >= 1 ? val : 7;
      e.target.value = zikirMinutes;
      if (zikirEnabled) {
          startZikirTimer();
      }
  });

  // 5. تاقاش
  document.getElementById('uyg-panel-close').addEventListener('click', () => {
    stopReading();
    stopZikirTimer();
    stopZikirAudio();
    wrapper.remove();
  });
  
  window.speechSynthesis.getVoices();
  startZikirTimer();
  prewarmNextZikirMp3(zikirIndex);
}