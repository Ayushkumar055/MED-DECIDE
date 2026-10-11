/* ========================================================
   MED-DECIDE: Emergency Decision-Making Engine
   Supports: 3 Scenarios, Leaflet GPS Maps, START Triage, 
   Degraded Comms, Ambulance Logistics, Tactical SFX, 
   Call-Signs, Gemini AI & Neon DB
   ======================================================== */

// Global App State
let isMuted = false;
let currentResponder = "Cadet Responder";
let pendingScenarioKey = null;

/* ================= TACTICAL SYNTH AUDIO ENGINE ================= */
class TacticalAudio {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 1. Military Push-to-Talk Radio Chirp
    playRadioChirp() {
        if (isMuted) return;
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(2400, now + 0.05);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        } catch (e) {
            console.warn("Audio Context init pending user gesture.");
        }
    }

    // 2. White Noise VHF Radio Static Burst
    playRadioStatic(duration = 0.4) {
        if (isMuted) return;
        try {
            this.init();
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = this.ctx.createBufferSource();
            whiteNoise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = 1800;
            filter.Q.value = 3.0;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            whiteNoise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            whiteNoise.start();
        } catch (e) {
            console.warn("Audio Context init pending user gesture.");
        }
    }

    // 3. Clinical ECG Heart Monitor Beep
    playHeartBeep(isCritical = false) {
        if (isMuted) return;
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            const freq = isCritical ? 980 : 750;
            const duration = isCritical ? 0.08 : 0.12;

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            console.warn("Audio Context init pending user gesture.");
        }
    }

    // 4. Emergency Klaxon / Siren Warning
    playEmergencySiren() {
        if (isMuted) return;
        try {
            this.init();
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.linearRampToValueAtTime(850, now + 0.25);
            osc.frequency.linearRampToValueAtTime(450, now + 0.5);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {
            console.warn("Audio Context init pending user gesture.");
        }
    }
}

const sfx = new TacticalAudio();

function toggleAudio() {
    isMuted = !isMuted;
    const btn = document.getElementById("audioToggleBtn");
    if (btn) {
        btn.innerText = isMuted ? "🔇" : "🔊";
    }
}

// Tactical GPS Incident Coordinates for Leaflet Map
const SCENARIO_COORDS = {
    road_accident: {
        center: [22.8046, 86.2029],
        accident: [22.8046, 86.2029],
        hospital: [22.8120, 86.2150],
        name: "Highway Junction Mile-42"
    },
    factory_fire: {
        center: [22.7850, 86.1850],
        accident: [22.7850, 86.1850],
        hospital: [22.8000, 86.1950],
        name: "Industrial Sector 4 Warehouse"
    },
    stampede: {
        center: [22.8100, 86.2200],
        accident: [22.8100, 86.2200],
        hospital: [22.8250, 86.2300],
        name: "Central Railway Terminal Gate 2"
    }
};

// Master Scenario Database
const SCENARIO_DATA = {
    road_accident: {
        title: "Road Accident: Multi-Vehicle Pile-up",
        subtitle: "Active Disaster Zone | Triage & Transport Phase",
        duration: 480, // 8 minutes
        ambulancesAvailable: 1,
        maxAmbulanceSlots: 2,
        patients: [
            {
                id: "P-101",
                age: "34M",
                injury: "Severe head trauma, snoring respirations, uncontrolled arterial bleed on right thigh",
                respiration: "36 /min",
                pulse: "Weak / Rapid (135 bpm)",
                mental: "Unresponsive to verbal",
                capillaryRefill: "> 2 sec",
                correctTriage: "RED",
                currentTag: null
            },
            {
                id: "P-102",
                age: "28F",
                injury: "Open compound tibia fracture, severe pain, crying out for help",
                respiration: "22 /min",
                pulse: "Strong (92 bpm)",
                mental: "Alert & Oriented",
                capillaryRefill: "< 2 sec",
                correctTriage: "YELLOW",
                currentTag: null
            },
            {
                id: "P-103",
                age: "19M",
                injury: "Superficial glass lacerations on forearms, ambulatory, able to walk and assist others",
                respiration: "18 /min",
                pulse: "Regular (76 bpm)",
                mental: "Alert, mild anxiety",
                capillaryRefill: "< 2 sec",
                correctTriage: "GREEN",
                currentTag: null
            },
            {
                id: "P-104",
                age: "52M",
                injury: "Crushed under car dashboard, massive bilateral chest depression, no breathing after airway repositioning",
                respiration: "0 /min (Apneic)",
                pulse: "Pulseless",
                mental: "No response",
                capillaryRefill: "Absent",
                correctTriage: "BLACK",
                currentTag: null
            },
            {
                id: "P-105",
                age: "41F",
                injury: "Blunt abdominal trauma, pale/clammy skin, rapid shallow breathing, confused and disoriented",
                respiration: "32 /min",
                pulse: "Radial pulse barely palpable (140 bpm)",
                mental: "Follows simple commands with delay",
                capillaryRefill: "3.5 sec",
                correctTriage: "RED",
                currentTag: null
            }
        ],
        criticalPatientIds: ["P-101", "P-105"],
        initialDispatchLog: "Multi-vehicle pile-up confirmed at Highway Mile-42. 5 casualties reported. Tele-support uplink active."
    },

    factory_fire: {
        title: "Industrial Chemical Fire & Inhalation",
        subtitle: "Hazardous Chemical Zone | Toxic Smoke Inhalation",
        duration: 360, // 6 minutes
        ambulancesAvailable: 2,
        maxAmbulanceSlots: 2,
        patients: [
            {
                id: "CF-201",
                age: "45M",
                injury: "Severe stridor, facial soot burns, bronchospasm, cyanotic lips",
                respiration: "38 /min",
                pulse: "Tachycardic (144 bpm)",
                mental: "Combative / Hypoxic",
                capillaryRefill: "> 3 sec",
                correctTriage: "RED",
                currentTag: null
            },
            {
                id: "CF-202",
                age: "29F",
                injury: "Full thickness chemical burns on bilateral arms (20% TBSA), stable airway",
                respiration: "24 /min",
                pulse: "Strong (104 bpm)",
                mental: "Alert, excruciating pain",
                capillaryRefill: "< 2 sec",
                correctTriage: "YELLOW",
                currentTag: null
            },
            {
                id: "CF-203",
                age: "38M",
                injury: "Mild cough and eye irritation from ammonia fumes, walking unassisted",
                respiration: "20 /min",
                pulse: "Normal (82 bpm)",
                mental: "Alert and answering questions",
                capillaryRefill: "< 2 sec",
                correctTriage: "GREEN",
                currentTag: null
            },
            {
                id: "CF-204",
                age: "50M",
                injury: "Trapped near gas valve, extensive 4th degree burns, non-responsive, apneic after head tilt",
                respiration: "0 /min",
                pulse: "No carotid pulse",
                mental: "Unresponsive",
                capillaryRefill: "Not measurable",
                correctTriage: "BLACK",
                currentTag: null
            },
            {
                id: "CF-205",
                age: "33F",
                injury: "Altered mental status from acute cyanide/CO inhalation, unresponsive to simple voice commands",
                respiration: "10 /min (Depressed)",
                pulse: "Weak (52 bpm)",
                mental: "Unresponsive",
                capillaryRefill: "3.2 sec",
                correctTriage: "RED",
                currentTag: null
            }
        ],
        criticalPatientIds: ["CF-201", "CF-205"],
        initialDispatchLog: "HAZMAT Alert: Chemical plant storage blaze. Fumes propagating. Thick concrete structure degrading radio communication."
    },

    stampede: {
        title: "Transit Hub Stampede Surge",
        subtitle: "Severe Mass Casualty Incident | Autonomous Triage Protocol",
        duration: 300, // 5 minutes
        ambulancesAvailable: 3,
        maxAmbulanceSlots: 2,
        patients: [
            {
                id: "ST-301",
                age: "22F",
                injury: "Traumatic asphyxiation, crushed chest, severe subconjunctival hemorrhage, gasping",
                respiration: "8 /min (Agonal)",
                pulse: "Barely palpable (44 bpm)",
                mental: "Unconscious",
                capillaryRefill: "> 4 sec",
                correctTriage: "RED",
                currentTag: null
            },
            {
                id: "ST-302",
                age: "47M",
                injury: "Pelvic crush injury with suspected internal hemorrhage, pale skin, cold extremities",
                respiration: "34 /min",
                pulse: "Thready (138 bpm)",
                mental: "Disoriented, agitated",
                capillaryRefill: "3 sec",
                correctTriage: "RED",
                currentTag: null
            },
            {
                id: "ST-303",
                age: "18M",
                injury: "Dislocated shoulder, ankle sprain from crowd crush, walked to staging area",
                respiration: "18 /min",
                pulse: "Regular (88 bpm)",
                mental: "Alert and oriented",
                capillaryRefill: "< 2 sec",
                correctTriage: "GREEN",
                currentTag: null
            },
            {
                id: "ST-304",
                age: "62F",
                injury: "Multiple rib fractures, severe localized chest pain, oxygen saturation stable",
                respiration: "26 /min",
                pulse: "Strong (98 bpm)",
                mental: "Alert and responsive",
                capillaryRefill: "< 2 sec",
                correctTriage: "YELLOW",
                currentTag: null
            },
            {
                id: "ST-305",
                age: "35M",
                injury: "Massive cranial trauma from heavy stampede impact, pupils fixed and dilated, apneic",
                respiration: "0 /min",
                pulse: "No central pulse",
                mental: "Comatose / Brain death signs",
                capillaryRefill: "Absent",
                correctTriage: "BLACK",
                currentTag: null
            }
        ],
        criticalPatientIds: ["ST-301", "ST-302"],
        initialDispatchLog: "CRITICAL: Severe overcrowding collapse at Terminal Gates. Cellular repeaters congested. Responders in full blackout."
    }
};

let activeScenarioKey = "road_accident";
let activeScenario = null;
let timerSeconds = 480;
let timerInterval = null;
let currentNetwork = 100;
let loadedAmbulance = [];
let mapInstance = null;
let isEvaluating = false;

/* ================= NAVIGATION ================= */

function startTraining() {
    sfx.playRadioChirp();
    document.getElementById("home").style.display = "none";
    document.getElementById("simulation-room").style.display = "none";
    document.getElementById("resultModal").style.display = "none";
    document.getElementById("callsignModal").style.display = "none";
    document.getElementById("scenarios").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToHome() {
    clearInterval(timerInterval);
    resetDispatchButton();
    document.getElementById("scenarios").style.display = "none";
    document.getElementById("simulation-room").style.display = "none";
    document.getElementById("resultModal").style.display = "none";
    document.getElementById("callsignModal").style.display = "none";
    document.getElementById("home").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    fetchLeaderboard();
}

function abortSimulation() {
    if (confirm("Are you sure you want to abort the emergency response? All progress will be lost.")) {
        clearInterval(timerInterval);
        resetDispatchButton();
        document.getElementById("simulation-room").style.display = "none";
        document.getElementById("callsignModal").style.display = "none";
        document.getElementById("scenarios").style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function scrollToFeatures() {
    const el = document.getElementById("features");
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

/* ================= LAUNCH SELECTED SCENARIO ================= */

function selectScenario(scenarioKey) {
    if (!SCENARIO_DATA[scenarioKey]) {
        alert("Scenario data not found!");
        return;
    }

    sfx.playRadioChirp();
    pendingScenarioKey = scenarioKey;
    
    // Open call-sign input modal first
    document.getElementById("callsignModal").style.display = "flex";
    const input = document.getElementById("responderCallsignInput");
    if (input) {
        input.value = currentResponder !== "Cadet Responder" ? currentResponder : "";
        input.focus();
    }
}

function confirmDeployment() {
    const input = document.getElementById("responderCallsignInput");
    const val = input ? input.value.trim() : "";
    currentResponder = val || "Cadet Responder";

    sfx.playRadioChirp();
    document.getElementById("callsignModal").style.display = "none";
    document.getElementById("scenarios").style.display = "none";
    document.getElementById("simulation-room").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });

    activeScenarioKey = pendingScenarioKey;
    activeScenario = JSON.parse(JSON.stringify(SCENARIO_DATA[pendingScenarioKey]));
    initSimulation();
}

/* ================= LEAFLET GPS MAP CONTROLLER ================= */

function initLeafletMap(scenarioKey) {
    const coords = SCENARIO_COORDS[scenarioKey] || SCENARIO_COORDS.road_accident;
    
    const coordEl = document.getElementById("gpsCoords");
    if (coordEl) {
        coordEl.innerText = `${coords.accident[0]}° N, ${coords.accident[1]}° E`;
    }

    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }

    setTimeout(() => {
        const mapContainer = document.getElementById('simMap');
        if (!mapContainer) return;

        mapInstance = L.map('simMap').setView(coords.center, 14);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
            maxZoom: 16
        }).addTo(mapInstance);

        // Accident Zone Pin
        L.marker(coords.accident).addTo(mapInstance)
            .bindPopup(`<b>🚨 Incident Zone</b><br>${coords.name}`)
            .openPopup();

        // Receiving Hospital Pin
        L.marker(coords.hospital).addTo(mapInstance)
            .bindPopup("<b>🏥 Trauma Center</b><br>Receiving Facility");

        // Evacuation Line
        L.polyline([coords.accident, coords.hospital], {
            color: '#ff4d5a',
            weight: 3,
            dashArray: '6, 8'
        }).addTo(mapInstance);

        mapInstance.invalidateSize();
    }, 250);
}

/* ================= SIMULATION CONTROLLER ================= */

function resetDispatchButton() {
    isEvaluating = false;
    const finishBtn = document.getElementById("finishMissionBtn");
    if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.style.opacity = "1";
        finishBtn.style.cursor = "pointer";
        finishBtn.innerText = "Finalize Triage & Dispatch Transport →";
    }
}

function initSimulation() {
    timerSeconds = activeScenario.duration;
    loadedAmbulance = [];
    resetDispatchButton();

    document.getElementById("simSceneTitle").innerText = activeScenario.title;
    document.getElementById("simSceneSubtitle").innerText = `${activeScenario.subtitle} | Operator: [${currentResponder}]`;
    document.getElementById("ambulanceCount").innerText = `${activeScenario.ambulancesAvailable} Available`;

    if (activeScenarioKey === "stampede") {
        currentNetwork = 0;
        degradeComms(0, "⚡ IMMEDIATE BLACKOUT: Cell tower congested. Remote telemedicine completely offline.");
    } else if (activeScenarioKey === "factory_fire") {
        currentNetwork = 60;
        degradeComms(60, "Industrial interference detected. Concrete shielding causes packet delays.");
    } else {
        currentNetwork = 100;
        resetCommsUI();
    }

    renderPatients();
    updateAmbulanceBay();
    startMissionTimer();
    initLeafletMap(activeScenarioKey);

    const logs = document.getElementById("radioLogs");
    logs.innerHTML = `
        <div class="log-entry system-log">
            <span class="log-time">[00:00]</span> <strong>DISPATCH:</strong> ${activeScenario.initialDispatchLog}
        </div>
    `;
}

function renderPatients() {
    const container = document.getElementById("patientCardsContainer");
    container.innerHTML = "";

    activeScenario.patients.forEach((patient, idx) => {
        const card = document.createElement("div");
        card.className = `patient-card ${patient.currentTag ? 'tagged-' + patient.currentTag.toLowerCase() : ''}`;
        card.id = `card-${patient.id}`;

        const isLoaded = loadedAmbulance.includes(patient.id);

        card.innerHTML = `
            <div class="patient-header">
                <span class="patient-id">${patient.id} (${patient.age})</span>
                <span class="patient-status-badge" id="badge-${patient.id}">${patient.currentTag ? patient.currentTag : 'UNTRIAGED'}</span>
            </div>
            <p class="patient-summary"><strong>Clinical Signs:</strong> ${patient.injury}</p>
            <div class="vitals-grid">
                <div class="vital-unit"><span>RESPIRATION</span><strong>${patient.respiration}</strong></div>
                <div class="vital-unit"><span>PULSE / HR</span><strong>${patient.pulse}</strong></div>
                <div class="vital-unit"><span>MENTAL STATUS</span><strong>${patient.mental}</strong></div>
                <div class="vital-unit"><span>CAPILLARY REFILL</span><strong>${patient.capillaryRefill}</strong></div>
            </div>
            <div class="triage-controls">
                <button class="triage-btn red ${patient.currentTag === 'RED' ? 'active' : ''}" onclick="tagPatient(${idx}, 'RED')">🔴 RED (Immediate)</button>
                <button class="triage-btn yellow ${patient.currentTag === 'YELLOW' ? 'active' : ''}" onclick="tagPatient(${idx}, 'YELLOW')">🟡 YELLOW (Delayed)</button>
                <button class="triage-btn green ${patient.currentTag === 'GREEN' ? 'active' : ''}" onclick="tagPatient(${idx}, 'GREEN')">🟢 GREEN (Minor)</button>
                <button class="triage-btn black ${patient.currentTag === 'BLACK' ? 'active' : ''}" onclick="tagPatient(${idx}, 'BLACK')">⚫ BLACK (Morgue)</button>
                <button class="load-ambulance-btn ${isLoaded ? 'loaded' : ''}" onclick="toggleAmbulanceLoad('${patient.id}')">
                    ${isLoaded ? '✓ In Transport' : '🚑 Load Ambulance'}
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    updateTriageCount();
}

function tagPatient(index, tag) {
    activeScenario.patients[index].currentTag = tag;
    
    if (tag === 'RED') {
        sfx.playHeartBeep(true);
    } else {
        sfx.playHeartBeep(false);
    }

    renderPatients();
}

function updateTriageCount() {
    const assessed = activeScenario.patients.filter(p => p.currentTag !== null).length;
    document.getElementById("triagedCount").innerText = assessed;
}

/* ================= AMBULANCE LOGISTICS ================= */

function toggleAmbulanceLoad(patientId) {
    sfx.playRadioChirp();
    const existingIndex = loadedAmbulance.indexOf(patientId);
    if (existingIndex > -1) {
        loadedAmbulance.splice(existingIndex, 1);
    } else {
        if (loadedAmbulance.length >= activeScenario.maxAmbulanceSlots) {
            sfx.playEmergencySiren();
            alert(`Ambulance Capacity Reached: Maximum ${activeScenario.maxAmbulanceSlots} casualties permitted for this dispatch.`);
            return;
        }
        loadedAmbulance.push(patientId);
    }
    updateAmbulanceBay();
    renderPatients();
}

function updateAmbulanceBay() {
    const slot1 = document.getElementById("slot1");
    const slot2 = document.getElementById("slot2");

    if (loadedAmbulance[0]) {
        slot1.className = "slot-loaded";
        slot1.innerHTML = `<span><strong>${loadedAmbulance[0]}</strong> Loaded</span> <button class="remove-slot-btn" onclick="toggleAmbulanceLoad('${loadedAmbulance[0]}')">✕</button>`;
    } else {
        slot1.className = "slot-empty";
        slot1.innerText = "Empty Stretcher Slot 1";
    }

    if (loadedAmbulance[1]) {
        slot2.className = "slot-loaded";
        slot2.innerHTML = `<span><strong>${loadedAmbulance[1]}</strong> Loaded</span> <button class="remove-slot-btn" onclick="toggleAmbulanceLoad('${loadedAmbulance[1]}')">✕</button>`;
    } else {
        slot2.className = "slot-empty";
        slot2.innerText = "Empty Stretcher Slot 2";
    }
}

/* ================= TIMER & DEGRADED COMMS SIMULATOR ================= */

function startMissionTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timerSeconds--;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const secs = String(timerSeconds % 60).padStart(2, '0');
        document.getElementById("simTimer").innerText = `${mins}:${secs}`;

        if (activeScenarioKey === "road_accident") {
            if (timerSeconds === 360) {
                degradeComms(60, "Low bandwidth. Telemedicine video feed laggy.");
            } else if (timerSeconds === 200) {
                degradeComms(30, "⚠️ Radio repeater failure. Voice channel unstable.");
            } else if (timerSeconds === 80) {
                degradeComms(10, "⚡ TOTAL BLACKOUT: Operating autonomously.");
            }
        } else if (activeScenarioKey === "factory_fire") {
            if (timerSeconds === 240) {
                degradeComms(25, "⚠️ Metal roof and toxic fumes shielding frequencies. Heavy packet drop.");
            } else if (timerSeconds === 90) {
                degradeComms(5, "⚡ Signal collapsed. No base response.");
            }
        }

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            sfx.playEmergencySiren();
            alert("Time Limit Expired! Submitting current triage decisions.");
            evaluateDecisions();
        }
    }, 1000);
}

function resetCommsUI() {
    const badge = document.getElementById("commPercent");
    const banner = document.getElementById("networkAlert");
    const bannerText = document.getElementById("commStatusText");

    badge.innerText = "100%";
    badge.className = "status-green";
    banner.className = "network-banner normal";
    bannerText.innerText = "Uplink Stable (100% Signal) — Tele-dispatch connected to Trauma Center";
}

function degradeComms(level, message) {
    currentNetwork = level;

    if (level <= 25) {
        sfx.playRadioStatic(0.6);
        sfx.playEmergencySiren();
    } else {
        sfx.playRadioStatic(0.3);
    }

    const badge = document.getElementById("commPercent");
    const banner = document.getElementById("networkAlert");
    const bannerText = document.getElementById("commStatusText");

    badge.innerText = `${level}%`;

    if (level > 60) {
        badge.className = "status-green";
        banner.className = "network-banner normal";
    } else if (level > 25) {
        badge.className = "status-yellow";
        banner.className = "network-banner degraded";
    } else {
        badge.className = "status-red";
        banner.className = "network-banner blackout";
    }

    bannerText.innerText = message;
    addRadioLog("RELAY TOWER", message, level <= 25);
}

function addRadioLog(sender, text, isScrambled = false) {
    const logs = document.getElementById("radioLogs");
    const entry = document.createElement("div");
    entry.className = `log-entry ${isScrambled ? 'static' : ''}`;
    
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    let displayText = text;
    if (currentNetwork <= 20) {
        displayText = text.replace(/[aeiou]/gi, "■");
    }

    entry.innerHTML = `<span class="log-time">[${timeStr}]</span> <strong>${sender}:</strong> ${displayText}`;
    logs.appendChild(entry);
    logs.scrollTop = logs.scrollHeight;
}

/* ================= RESULT EVALUATION, AI & NEON DB ================= */

async function evaluateDecisions() {
    if (isEvaluating) return;
    isEvaluating = true;

    sfx.playRadioChirp();
    clearInterval(timerInterval);

    const finishBtn = document.getElementById("finishMissionBtn");
    if (finishBtn) {
        finishBtn.disabled = true;
        finishBtn.style.opacity = "0.6";
        finishBtn.style.cursor = "not-allowed";
        finishBtn.innerText = "Auditing Tactical Decisions...";
    }

    let triageCorrectCount = 0;
    const tbody = document.getElementById("auditTableBody");
    tbody.innerHTML = "";

    activeScenario.patients.forEach(patient => {
        const isCorrect = patient.currentTag === patient.correctTriage;
        if (isCorrect) triageCorrectCount++;

        const isLoaded = loadedAmbulance.includes(patient.id);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${patient.id}</strong> (${patient.age})</td>
            <td>${patient.injury.substring(0, 38)}...</td>
            <td><span class="tag-pill ${patient.currentTag || 'NONE'}">${patient.currentTag || 'UNTAGGED'}</span></td>
            <td><span class="tag-pill ${patient.correctTriage}">${patient.correctTriage}</span></td>
            <td>${isLoaded ? '✅ Evacuated' : '⏸️ Staged'}</td>
        `;
        tbody.appendChild(tr);
    });

    const criticalEvacuated = loadedAmbulance.filter(id => activeScenario.criticalPatientIds.includes(id)).length;
    let transportScore = (criticalEvacuated / activeScenario.criticalPatientIds.length) * 100;

    const triageScore = (triageCorrectCount / activeScenario.patients.length) * 100;
    const overallScore = Math.round((triageScore * 0.6) + (transportScore * 0.4));

    document.getElementById("finalScoreVal").innerText = `${overallScore}%`;
    document.getElementById("triageScoreVal").innerText = `${triageCorrectCount} / ${activeScenario.patients.length}`;
    document.getElementById("evacScoreVal").innerText = criticalEvacuated === activeScenario.criticalPatientIds.length ? "OPTIMAL" : (criticalEvacuated > 0 ? "PARTIAL" : "CRITICAL FAIL");
    document.getElementById("commsScoreVal").innerText = currentNetwork <= 30 ? "TACTICAL" : "STANDARD";

    const elapsed = activeScenario.duration - timerSeconds;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    const timeUsedFormatted = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;
    document.getElementById("missionDuration").innerText = `Time Used: ${timeUsedFormatted}`;

    const badge = document.getElementById("gradeBadge");
    if (overallScore >= 80) {
        badge.innerText = "SURVIVAL RATING: A (EXEMPLARY)";
        badge.style.color = "#38d996";
    } else if (overallScore >= 60) {
        badge.innerText = "SURVIVAL RATING: B (COMPETENT)";
        badge.style.color = "#ffb34f";
    } else {
        badge.innerText = "SURVIVAL RATING: C (CRITICAL FAILURES)";
        badge.style.color = "#ff4d5a";
    }

    document.getElementById("resultModal").style.display = "flex";

    const aiFeedback = await generateAiDebrief(triageCorrectCount, criticalEvacuated, overallScore);
    await saveMissionToNeon(aiFeedback, overallScore, triageCorrectCount, criticalEvacuated, timeUsedFormatted);
}

async function generateAiDebrief(correctTriage, criticalEvacuated, overallScore) {
    const feedbackBox = document.getElementById("aiFeedbackText");
    feedbackBox.innerHTML = `<em>Contacting AI Medical Command for live tactical audit...</em>`;

    let generatedText = "";

    try {
        const response = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scenarioTitle: activeScenario.title,
                overallScore: overallScore,
                triageAccuracy: `${correctTriage} / ${activeScenario.patients.length}`,
                evacuatedPatients: loadedAmbulance,
                networkLevel: currentNetwork,
                patients: activeScenario.patients
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.feedback) {
                generatedText = data.feedback;
                feedbackBox.innerHTML = `<strong>Live Gemini Medical Controller:</strong><br>${generatedText.replace(/\n/g, '<br>')}`;
                return generatedText;
            }
        }
    } catch (err) {
        console.warn("Backend evaluate offline. Engaging deterministic fallback:", err);
    }

    const totalCritical = activeScenario.criticalPatientIds.length;

    if (criticalEvacuated === totalCritical && correctTriage === activeScenario.patients.length) {
        generatedText = `Flawless Tactical Execution. In the ${activeScenario.title}, you prioritized all immediate life threats (${activeScenario.criticalPatientIds.join(', ')}) correctly. Full protocol was preserved even with network interference.`;
    } else if (criticalEvacuated < totalCritical) {
        generatedText = `Evacuation Priority Error: You failed to allocate ambulance slots to all RED immediate victims. In high-casualty events, expectant/deceased or non-ambulatory minor injuries must not consume limited transport assets.`;
    } else {
        generatedText = `Triage Misclassification: Transport priority was maintained, but casualty assessments deviated from standard START triage criteria. Check respiration rate (>30/min), perfusion (>2s capillary refill), and mental orientation.`;
    }

    feedbackBox.innerHTML = generatedText;
    return generatedText;
}

// Save Mission to Neon Postgres with Custom Responder Tag
async function saveMissionToNeon(aiFeedbackText, overallScore, triageCorrectCount, criticalEvacuated, elapsedStr) {
    try {
        const evacStatus = criticalEvacuated === activeScenario.criticalPatientIds.length 
            ? "OPTIMAL" 
            : (criticalEvacuated > 0 ? "PARTIAL" : "CRITICAL FAIL");

        const res = await fetch("/api/save-mission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                responderName: currentResponder,
                scenarioTitle: activeScenario.title,
                overallScore: overallScore,
                triageAccuracy: `${triageCorrectCount} / ${activeScenario.patients.length}`,
                evacStatus: evacStatus,
                timeUsed: elapsedStr,
                aiFeedback: aiFeedbackText
            })
        });

        const data = await res.json();
        if (data.success) {
            console.log("💾 Mission successfully saved in Neon DB. Mission ID:", data.missionId);
            fetchLeaderboard();
        }
    } catch (err) {
        console.warn("Neon DB Save Error:", err);
    }
}

function retryScenario() {
    document.getElementById("resultModal").style.display = "none";
    initSimulation();
}

/* ================= LIVE LEADERBOARD ENGINE ================= */

async function fetchLeaderboard() {
    const tbody = document.getElementById("leaderboardBody");
    if (!tbody) return;

    try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) {
            throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();

        if (!data.leaderboard || data.leaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-state">No missions logged yet. Be the first to deploy!</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        data.leaderboard.forEach((entry, idx) => {
            const tr = document.createElement("tr");

            let rankMarkup = `#${idx + 1}`;
            if (idx === 0) rankMarkup = `<span class="rank-badge rank-1">1</span>`;
            else if (idx === 1) rankMarkup = `<span class="rank-badge rank-2">2</span>`;
            else if (idx === 2) rankMarkup = `<span class="rank-badge rank-3">3</span>`;

            tr.innerHTML = `
                <td>${rankMarkup}</td>
                <td><strong>${entry.responder_name}</strong></td>
                <td>${entry.scenario_title}</td>
                <td>${entry.triage_accuracy}</td>
                <td>${entry.time_used}</td>
                <td class="score-badge">${entry.overall_score}%</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.warn("Failed to load leaderboard:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="loading-state">⚠️ Offline: Could not sync with database.</td></tr>`;
    }
}

fetchLeaderboard();

document.addEventListener("DOMContentLoaded", fetchLeaderboard);
window.addEventListener("load", fetchLeaderboard);