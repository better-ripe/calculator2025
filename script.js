// Default logic in case fetch fails or for initialization
let logic = {
    constants: {
        baseFee: 500,
        factor1: 352,
        factor2: 9.7
    },
    ipv4: {
        offset: 7,
        min_address_threshold: 255
    },
    ipv6: {
        small_allocation_threshold: 15,
        small_allocation_score: 1,
        large_allocation_offset: 2
    }
};

const state = {
    ipv4: [],
    ipv6: []
};

// DOM Elements
const els = {
    ipv4Prefix: document.getElementById('ipv4-prefix'),
    addIpv4: document.getElementById('add-ipv4'),
    ipv4List: document.getElementById('ipv4-list'),
    ipv4Total24s: document.getElementById('ipv4-total-24s'),
    ipv4Addresses: document.getElementById('ipv4-addresses'),
    ipv4Fee: document.getElementById('ipv4-fee'),
    
    ipv6Prefix: document.getElementById('ipv6-prefix'),
    addIpv6: document.getElementById('add-ipv6'),
    ipv6List: document.getElementById('ipv6-list'),
    ipv6Total32s: document.getElementById('ipv6-total-32s'),
    ipv6Fee: document.getElementById('ipv6-fee'),
    
    finalFee: document.getElementById('final-fee'),
    
    toggleSettings: document.getElementById('toggle-settings'),
    settingsPanel: document.getElementById('settings-panel'),
    inputs: {
        baseFee: document.getElementById('base-fee'),
        factor1: document.getElementById('factor1'),
        factor2: document.getElementById('factor2')
    },
    resetParams: document.getElementById('reset-params')
};

// Initialize
async function init() {
    try {
        const response = await fetch('logic.json');
        if (response.ok) {
            logic = await response.json();
        }
    } catch (e) {
        console.warn('Could not load logic.json, using defaults.', e);
    }
    
    // Fill settings inputs
    updateSettingsInputs();
    
    // Event Listeners
    els.addIpv4.addEventListener('click', () => addResource('ipv4'));
    els.addIpv6.addEventListener('click', () => addResource('ipv6'));
    
    els.toggleSettings.addEventListener('click', () => {
        els.settingsPanel.classList.toggle('hidden');
        els.toggleSettings.textContent = els.settingsPanel.classList.contains('hidden') 
            ? 'Show Configuration Parameters' 
            : 'Hide Configuration Parameters';
    });
    
    // Settings change listeners
    Object.keys(els.inputs).forEach(key => {
        els.inputs[key].addEventListener('input', (e) => {
            logic.constants[key] = parseFloat(e.target.value) || 0;
            calculate();
        });
    });

    els.resetParams.addEventListener('click', () => {
        // Reload page or re-fetch could work, but simple reset to known defaults:
        fetch('logic.json').then(r => r.json()).then(data => {
            logic = data;
            updateSettingsInputs();
            calculate();
        });
    });

    calculate();
}

function updateSettingsInputs() {
    els.inputs.baseFee.value = logic.constants.baseFee;
    els.inputs.factor1.value = logic.constants.factor1;
    els.inputs.factor2.value = logic.constants.factor2;
}

function addResource(type) {
    const select = type === 'ipv4' ? els.ipv4Prefix : els.ipv6Prefix;
    const val = parseInt(select.value);
    state[type].push(val);
    renderList(type);
    calculate();
}

function removeResource(type, index) {
    state[type].splice(index, 1);
    renderList(type);
    calculate();
}

function renderList(type) {
    const container = type === 'ipv4' ? els.ipv4List : els.ipv6List;
    container.innerHTML = '';
    
    state[type].forEach((prefix, index) => {
        const div = document.createElement('div');
        div.className = 'resource-item';
        div.innerHTML = `
            <span>/${prefix}</span>
            <button class="btn-remove" onclick="removeResource('${type}', ${index})">×</button>
        `;
        container.appendChild(div);
    });
}

function calculate() {
    // 1. Calculate totals
    const total24s = state.ipv4.reduce((sum, p) => sum + Math.pow(2, 24 - p), 0);
    const total32s = state.ipv6.reduce((sum, p) => sum + Math.pow(2, 32 - p), 0);
    
    const ipv4Addresses = total24s * 256;
    
    // 2. Calculate Scores (Unique Identifiers)
    let ipv4Score = 0;
    if (ipv4Addresses > logic.ipv4.min_address_threshold) {
        ipv4Score = Math.log2(ipv4Addresses) - logic.ipv4.offset;
        // Round to 4 decimals for precision if needed, but JS float is fine usually
        // Excel uses ROUND(..., 4) then uses that for fee.
        ipv4Score = Math.round(ipv4Score * 10000) / 10000;
    }
    
    let ipv6Score = 0;
    if (total32s > 0) {
        if (total32s <= logic.ipv6.small_allocation_threshold) {
            ipv6Score = logic.ipv6.small_allocation_score;
        } else {
            ipv6Score = Math.log2(total32s) - logic.ipv6.large_allocation_offset;
            ipv6Score = Math.round(ipv6Score * 10000) / 10000;
        }
    }
    
    // 3. Calculate Fees
    const { baseFee, factor1, factor2 } = logic.constants;
    
    const ipv4Fee = Math.round(baseFee + (factor1 * ipv4Score) + (factor2 * Math.pow(ipv4Score, 2)));
    const ipv6Fee = Math.round(baseFee + (factor1 * ipv6Score) + (factor2 * Math.pow(ipv6Score, 2)));
    
    // Final
    const finalFee = Math.max(ipv4Fee, ipv6Fee);
    
    // 4. Update UI
    els.ipv4Total24s.textContent = total24s;
    els.ipv4Addresses.textContent = ipv4Addresses.toLocaleString();
    els.ipv4Fee.textContent = '€' + ipv4Fee.toLocaleString();
    
    els.ipv6Total32s.textContent = total32s;
    els.ipv6Fee.textContent = '€' + ipv6Fee.toLocaleString();
    
    els.finalFee.textContent = '€' + finalFee.toLocaleString();
}

// Make functions global for inline onclick
window.removeResource = removeResource;

init();
