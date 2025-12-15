
const ctx = document.getElementById('feeChart').getContext('2d');

// Constants & Rates
const RATES = {
    EUR_USD: 1.175,
    AUD_USD: 0.6646
};

// RIPE Model B Logic (from script.js/logic.json)
// Fee = Base + (F1 * Score) + (F2 * Score^2)
// Score = log2(Addresses) - 7
const RIPE = {
    base: 500,
    f1: 352,
    f2: 9.7,
    calculate: (prefix) => {
        const addresses = Math.pow(2, 32 - prefix);
        const score = Math.log2(addresses) - 7;
        const feeEUR = RIPE.base + (RIPE.f1 * score) + (RIPE.f2 * Math.pow(score, 2));
        return feeEUR * RATES.EUR_USD;
    }
};

// APNIC (2025)
// Fee = Base * (BitFactor ^ AddressBits)
// AddressBits = log2(Addresses) - 8
// Base = 1236 AUD, BitFactor = 1.315
const APNIC = {
    base: 1236,
    bitFactor: 1.315,
    calculate: (prefix) => {
        const addresses = Math.pow(2, 32 - prefix);
        const addressBits = Math.log2(addresses) - 8;
        const feeAUD = APNIC.base * Math.pow(APNIC.bitFactor, addressBits);
        return feeAUD * RATES.AUD_USD;
    }
};

// ARIN (2025)
// Categories based on prefix range
const ARIN = {
    calculate: (prefix) => {
        let feeUSD = 0;
        if (prefix >= 24) feeUSD = 262.50;      // 3X-Small: /24 or smaller
        else if (prefix > 22) feeUSD = 525.00;  // 2X-Small: >/24 to /22 (covers /23)
        else if (prefix > 20) feeUSD = 1050.00; // X-Small: >/22 to /20 (covers /22, /21)
        else if (prefix > 18) feeUSD = 2100.00; // Small: >/20 to /18 (covers /20, /19)
        else if (prefix > 16) feeUSD = 4200.00; // Medium: >/18 to /16 (covers /18, /17)
        else if (prefix > 14) feeUSD = 8400.00; // Large: >/16 to /14 (covers /16, /15)
        else if (prefix > 12) feeUSD = 16800.00;// Larger: >/14 to /12 (covers /14, /13)
        else if (prefix > 10) feeUSD = 33600.00;// (> /12 to /10) covers /12, /11
        else feeUSD = 67200.00;                 // /10
        
        // Refined logic based on strict "Up to" or ranges
        // ARIN ranges are strict. 
        // /24 -> 3X-Small
        // /23 -> 2X-Small
        // /22 -> 2X-Small (Wait, ARIN says "> /24 to /22". Does /22 fall in 2X or X? 
        // "2X-Small: /24–/22 IPv4 block size" usually means UP TO /22.
        // "X-Small: /22–/20". Usually means > /22.
        // Let's assume the breakpoint is inclusive of the larger prefix in the smaller category?
        // Actually, usually RIRs say "Up to /22" means /22 is included. "Greater than /22" is next.
        // Let's adjust:
        
        if (prefix >= 24) return 262.50;
        if (prefix >= 22) return 525.00;
        if (prefix >= 20) return 1050.00;
        if (prefix >= 18) return 2100.00;
        if (prefix >= 16) return 4200.00;
        if (prefix >= 14) return 8400.00;
        if (prefix >= 12) return 16800.00;
        if (prefix >= 10) return 33600.00;
        return 67200.00;
    }
};

// LACNIC (ISP 2025)
// Nano < /22 (so /24, /23)
// Micro < /20 (so /22, /21)
const LACNIC = {
    calculate: (prefix) => {
        // "Less than /22" means /22 is NOT included? 
        // Usually "Less than /22" means /23, /24...
        // If I have a /22, I am not "Less than /22". I am "Less than /20".
        // Let's interpret based on standard intervals.
        
        if (prefix > 22) return 632;    // < /22 (/23, /24)
        if (prefix > 20) return 1055;   // < /20 (/21, /22)
        if (prefix > 18) return 2215;   // < /18
        if (prefix > 16) return 6012;   // < /16
        if (prefix > 14) return 14766;  // < /14
        if (prefix > 12) return 29532;  // < /12
        if (prefix > 10) return 59064;  // < /10
        return 118128; // /10 (<= /8 category is 3X Large < /8. Wait, /10 is < /8?)
                       // Table says "2X Large: Less than /10". So /10 is NOT in 2X Large.
                       // Next is "3X Large: Less than /08". So /10 falls here.
    }
};

// Generate Data
const prefixes = [];
for (let p = 24; p >= 10; p--) {
    prefixes.push(p);
}

const data = {
    labels: prefixes.map(p => `/${p}`),
    datasets: [
        {
            label: 'RIPE (Model B)',
            data: prefixes.map(p => RIPE.calculate(p)),
            borderColor: '#007bff', // Primary Blue
            backgroundColor: '#007bff',
            tension: 0.1
        },
        {
            label: 'APNIC',
            data: prefixes.map(p => APNIC.calculate(p)),
            borderColor: '#dc3545', // Red
            backgroundColor: '#dc3545',
            tension: 0.1
        },
        {
            label: 'ARIN',
            data: prefixes.map(p => ARIN.calculate(p)),
            borderColor: '#28a745', // Green
            backgroundColor: '#28a745',
            stepped: true // Step chart for fixed categories
        },
        {
            label: 'LACNIC',
            data: prefixes.map(p => LACNIC.calculate(p)),
            borderColor: '#ffc107', // Yellow
            backgroundColor: '#ffc107',
            stepped: true
        }
    ]
};

const config = {
    type: 'line',
    data: data,
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                type: 'logarithmic',
                title: {
                    display: true,
                    text: 'Annual Fee (USD)'
                },
                ticks: {
                    callback: function(value, index, values) {
                        return '$' + value.toLocaleString();
                    }
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'IPv4 Prefix Size'
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            },
            title: {
                display: true,
                text: 'RIR Annual Fee Comparison (Log Scale)'
            }
        }
    }
};

const myChart = new Chart(ctx, config);
