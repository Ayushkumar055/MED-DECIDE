import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files directly from current folder
app.use(express.static('.'));

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Neon Postgres Client
const sql = neon(process.env.DATABASE_URL);

// 1. Evaluate Route via Gemini AI
app.post('/api/evaluate', async (req, res) => {
    const { scenarioTitle, overallScore, triageAccuracy, evacuatedPatients, networkLevel, patients } = req.body;

    try {
        const prompt = `
You are the Chief Medical Controller evaluating a first responder during a mass casualty emergency simulator.
Analyze the following tactical session data and generate a professional, authoritative 3-4 sentence clinical debrief.

Incident Scenario: ${scenarioTitle}
Survival Score: ${overallScore}%
Triage Accuracy: ${triageAccuracy}
Evacuated in Ambulance: ${JSON.stringify(evacuatedPatients)}
Final Radio Uplink: ${networkLevel}%

Patient Assessments:
${patients.map(p => `- ID: ${p.id} (${p.age}) \vert{} Injury: "${p.injury}" | User Tag: "${p.currentTag || 'UNTAGGED'}" | Correct START Tag: "${p.correctTriage}"`).join('\n')}

Audit Instructions:
1. Pinpoint any critical triage mistakes (e.g., mislabeling Immediate RED patients or wasting ambulance transport on Expectant/BLACK or Minor/GREEN casualties).
2. Critique responder adaptability during communication signal degradation / radio blackout.
3. Keep the feedback sharp, realistic, and clinically authoritative.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
        });

        res.json({ feedback: response.text });
    } catch (error) {
        console.warn("Gemini API fallback engine active:", error.message || error);

        const redPatients = patients.filter(p => p.correctTriage === 'RED').map(p => p.id);
        const redEvacuated = evacuatedPatients.filter(id => redPatients.includes(id)).length;

        let fallbackFeedback = "";
        if (redEvacuated === redPatients.length && triageAccuracy.startsWith(`${patients.length}`)) {
            fallbackFeedback = `Exemplary command execution during ${scenarioTitle}. All priority RED immediate casualties (${redPatients.join(', ')}) were accurately triaged and evacuated before critical vitals deteriorated. Protocol adherence maintained under communication degradation.`;
        } else if (redEvacuated < redPatients.length) {
            fallbackFeedback = `Tactical evacuation breach observed in ${scenarioTitle}. Priority RED casualties were left staged while transport capacity was mismanaged. Immediate life-threats must always take priority over delayed or expectant cases.`;
        } else {
            fallbackFeedback = `Triage misclassification flagged during ${scenarioTitle}. Transport sequencing was partially maintained, but secondary victim assessment showed deviations from standard START triage protocols. Re-evaluate respiratory rate and peripheral perfusion criteria.`;
        }

        res.json({ feedback: fallbackFeedback });
    }
});

// 2. Save Mission Result to Neon DB
app.post('/api/save-mission', async (req, res) => {
    try {
        const { responderName, scenarioTitle, overallScore, triageAccuracy, evacStatus, timeUsed, aiFeedback } = req.body;

        const result = await sql`
            INSERT INTO mission_logs (responder_name, scenario_title, overall_score, triage_accuracy, evac_status, time_used, ai_feedback)
            VALUES (${responderName || 'Cadet Responder'}, ${scenarioTitle}, ${overallScore}, ${triageAccuracy}, ${evacStatus}, ${timeUsed}, ${aiFeedback})
            RETURNING id, created_at;
        `;

        console.log(`✅ Logged Mission #${result[0].id} to Neon DB`);
        res.json({ success: true, missionId: result[0].id });
    } catch (dbErr) {
        console.error("Neon DB Insert Error:", dbErr);
        res.status(500).json({ error: "Failed to log mission to Neon DB" });
    }
});

// 3. Fetch Top Leaderboard from Neon DB
app.get('/api/leaderboard', async (req, res) => {
    try {
        const rows = await sql`
            SELECT id, responder_name, scenario_title, overall_score, triage_accuracy, time_used, created_at
            FROM mission_logs
            ORDER BY overall_score DESC, created_at DESC
            LIMIT 10;
        `;
        res.json({ leaderboard: rows });
    } catch (dbErr) {
        console.error("Neon DB Query Error:", dbErr);
        res.status(500).json({ error: "Failed to fetch leaderboard from Neon DB" });
    }
});

app.listen(port, () => {
    console.log(`🚑 MED-DECIDE Backend running on http://localhost:${port}`);
});