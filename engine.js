let ctx = null, analyzer = null, historyData = [];
let saved = JSON.parse(localStorage.getItem('kashkesh_library') || '[]');
let lastPlayed = null;

// 1. Unified Audio Setup
function setupAudio() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyzer = ctx.createAnalyser();
        analyzer.fftSize = 2048;
        analyzer.connect(ctx.destination);
        startVisualizer();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return { c: ctx, a: analyzer };
}

// 2. Play Tone Logic
function playTone(s) {
    const { c, a } = setupAudio();
    const { frequency = 440, type = 'sine', duration = 0.2, gain = 0.3, delay = 0 } = s;

    const osc = c.createOscillator();
    const gNode = c.createGain();
    
    osc.connect(gNode);
    gNode.connect(a);
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime + delay);
    
    gNode.gain.setValueAtTime(0, c.currentTime + delay);
    gNode.gain.linearRampToValueAtTime(gain, c.currentTime + delay + 0.01);
    gNode.gain.setValueAtTime(gain, c.currentTime + delay + duration - 0.02);
    gNode.gain.linearRampToValueAtTime(0, c.currentTime + delay + duration);
    
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.01);
    lastPlayed = { engine: 'tone', ...s };
}

// 3. Play Noise Logic
function playNoise(s) {
    const { c, a } = setupAudio();
    const { duration = 0.1, gain = 0.15, delay = 0, filterFreq = 1000 } = s;

    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = c.createBufferSource();
    source.buffer = buffer;
    const gNode = c.createGain();
    const filter = c.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

    source.connect(filter);
    filter.connect(gNode);
    gNode.connect(a);

    gNode.gain.setValueAtTime(gain, c.currentTime + delay);
    gNode.gain.linearRampToValueAtTime(0, c.currentTime + delay + duration);
    
    source.start(c.currentTime + delay);
    lastPlayed = { engine: 'noise', ...s };
}

// 4. UI Trigger Functions
function handlePlayTone() {
    const s = {
        frequency: parseFloat(document.getElementById('frequency').value),
        type: document.getElementById('type').value,
        duration: parseFloat(document.getElementById('duration').value),
        gain: parseFloat(document.getElementById('gain').value)
    };
    playTone(s);
    addToHistory('Tone', s);
}

function handlePlayNoise() {
    const s = {
        duration: parseFloat(document.getElementById('nDuration').value),
        gain: parseFloat(document.getElementById('nGain').value),
        filterFreq: parseFloat(document.getElementById('nFilter').value)
    };
    playNoise(s);
    addToHistory('Noise', s);
}

function runImportedCode() {
    const code = document.getElementById('importBox').value;
    try {
        const runner = new Function('playTone', 'playNoise', code);
        runner(playTone, playNoise);
    } catch (e) { alert("Error: " + e.message); }
}

// 5. Visualizer Engine
function startVisualizer() {
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
        requestAnimationFrame(draw);
        analyzer.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#03dac6'; 
        canvasCtx.beginPath();

        let sliceWidth = canvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            let v = dataArray[i] / 128.0;
            let y = v * (canvas.height / 2);
            if (i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    };
    draw();
}

// 6. Data Management
function saveCurrent() {
    if (!lastPlayed) return alert("Play a sound first!");
    const name = document.getElementById('saveName').value || "New Sound";
    saved.unshift({ name, ...lastPlayed });
    localStorage.setItem('kashkesh_library', JSON.stringify(saved));
    document.getElementById('saveName').value = "";
    renderLists();
}

function deleteSound(e, index) {
    e.stopPropagation();
    saved.splice(index, 1);
    localStorage.setItem('kashkesh_library', JSON.stringify(saved));
    renderLists();
}

function addToHistory(type, settings) {
    historyData.unshift({ type, settings, time: new Date().toLocaleTimeString() });
    renderLists();
}

function renderLists() {
    const hList = document.getElementById('historyList');
    if (hList) {
        hList.innerHTML = historyData.slice(0, 10).map(item => `
            <div class="sound-item" onclick='${item.type === "Tone" ? "playTone" : "playNoise"}(${JSON.stringify(item.settings)})'>
                <span>[${item.type}]</span> <span>${item.time}</span>
            </div>
        `).join('');
    }
    const sList = document.getElementById('savedList');
    if (sList) {
        sList.innerHTML = saved.map((s, i) => `
            <div class="sound-item" onclick='loadFromLibrary(${JSON.stringify(s)})'>
                <div><span class="tag" style="background:${s.engine === 'tone' ? '#bb86fc' : '#ff7597'}; color:black">${(s.engine || 'tone').toUpperCase()}</span> <strong>${s.name}</strong></div>
                <button onclick="deleteSound(event, ${i})" style="background:transparent; color:#ff5252; border:none; cursor:pointer;">✕</button>
            </div>
        `).join('');
    }
}

function loadFromLibrary(item) {
    if (item.engine === 'noise') {
        document.getElementById('nDuration').value = item.duration;
        document.getElementById('nGain').value = item.gain;
        document.getElementById('nFilter').value = item.filterFreq || 1000;
        playNoise(item);
    } else {
        document.getElementById('frequency').value = item.frequency;
        document.getElementById('type').value = item.type;
        document.getElementById('duration').value = item.duration;
        document.getElementById('gain').value = item.gain;
        playTone(item);
    }
    updateUI();
}

function updateUI() {
    // Tone UI
    const f = document.getElementById('frequency').value, 
          t = document.getElementById('type').value, 
          d = document.getElementById('duration').value, 
          g = document.getElementById('gain').value;
          
    document.getElementById('freqVal').innerText = f + 'Hz'; 
    document.getElementById('durVal').innerText = d + 's'; 
    document.getElementById('gainVal').innerText = g;
    document.getElementById('toneCode').innerText = `playTone({ frequency: ${f}, type: '${t}', duration: ${d}, gain: ${g} });`;
    
    // Noise UI
    const nd = document.getElementById('nDuration').value, 
          ng = document.getElementById('nGain').value, 
          nf = document.getElementById('nFilter').value;
          
    document.getElementById('nDurVal').innerText = nd + 's'; 
    document.getElementById('nGainVal').innerText = ng; 
    document.getElementById('nFiltVal').innerText = nf + 'Hz';
    document.getElementById('noiseCode').innerText = `playNoise({ duration: ${nd}, gain: ${ng}, filterFreq: ${nf} });`;
}

// --- BOOTSTRAPPER ---
// Ensures all elements exist before attaching listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial Render
    renderLists();
    updateUI();

    // Attach listeners to all inputs for real-time label updates
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('input', updateUI);
    });
});