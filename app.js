// Initialize Lucide icons
lucide.createIcons();

const analyzeForm = document.getElementById('analyze-form');
const pageUrlInput = document.getElementById('page-url');
const resultsContainer = document.getElementById('results-container');
const loadingState = document.getElementById('loading-state');
const roastText = document.getElementById('roast-text');
const pageScore = document.getElementById('page-score');
const tipsList = document.getElementById('tips-list');
const analyzeBtn = document.getElementById('analyze-btn');

const WEBHOOK_URL = 'https://querulously-noncustodial-glenna.ngrok-free.dev/webhook/landing-page-analyzer';

analyzeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = pageUrlInput.value.trim();
    if (!url) return;

    // Show loading state
    setLoading(true);
    
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'Landing Page URL': url
            })
        });

        const responseText = await response.text();
        console.log('Raw Response:', responseText);

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}. Please check if your n8n workflow is active.`);
        }

        if (!responseText) {
            throw new Error('Empty response received. Please ensure your n8n workflow is properly configured to return data.');
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse response as JSON:', responseText);
            // If it's not JSON but we have text, we might be able to use it anyway
            data = { output: responseText };
        }
        
        renderResults(data);
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
        setLoading(false);
    }
});

function setLoading(isLoading) {
    if (isLoading) {
        loadingState.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span>Analyzing...</span>';
    } else {
        loadingState.classList.add('hidden');
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>Analyze</span><i data-lucide="sparkles"></i>';
        lucide.createIcons();
    }
}

function renderResults(data) {
    console.log('Processing data:', data);
    let rawOutput = '';
    let tips = [];

    // 1. Extract raw text from any n8n format
    if (typeof data === 'string') {
        rawOutput = data;
    } else if (data && typeof data === 'object') {
        rawOutput = data.output || data.text || data.response || data.myField || '';
        if (!rawOutput) {
            const stringKeys = Object.keys(data).filter(k => typeof data[k] === 'string');
            if (stringKeys.length > 0) {
                rawOutput = data[stringKeys.reduce((a, b) => data[a].length > data[b].length ? a : b)];
            } else {
                rawOutput = JSON.stringify(data);
            }
        }
    }

    // 2. Try to parse JSON to find "tips" array
    try {
        const jsonMatch = rawOutput.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            tips = Array.isArray(parsed) ? parsed : (parsed.tips || []);
        }
    } catch (e) {
        console.warn("Could not parse JSON for tips, falling back to text parsing");
    }

    // 3. Fallback: Parse numbered list from text if tips array is empty
    if (tips.length === 0 && rawOutput) {
        const lines = rawOutput.split('\n');
        const tipRegex = /^(\d+)\.\s*(.+)/;
        let currentTip = null;

        lines.forEach(line => {
            const match = line.trim().match(tipRegex);
            if (match) {
                if (currentTip) tips.push(currentTip);
                const parts = match[2].split(/[:\?-]/);
                currentTip = {
                    title: parts[0].trim(),
                    description: parts.slice(1).join(':').trim() || "See details in analysis."
                };
            } else if (currentTip && line.trim() && !line.trim().match(/^\d+\./)) {
                currentTip.description += ' ' + line.trim();
            }
        });
        if (currentTip) tips.push(currentTip);
    }

    // 4. Render Tips
    tipsList.innerHTML = '';
    const tipsToUse = tips.slice(0, 10);
    
    if (tipsToUse.length === 0) {
        tipsList.innerHTML = '<p class="error-msg">Could not extract tips. Please check your AI agent output format.</p>';
    } else {
        tipsToUse.forEach((tip, index) => {
            const tipCard = document.createElement('div');
            tipCard.className = 'tip-card';
            tipCard.innerHTML = `
                <div class="tip-number">${index + 1}</div>
                <div class="tip-content">
                    <h4>${tip.title || 'Optimization Tip'}</h4>
                    <p>${tip.description || 'Actionable advice for your landing page.'}</p>
                </div>
            `;
            tipsList.appendChild(tipCard);
        });
    }

    setLoading(false);
    resultsContainer.classList.remove('hidden');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}
