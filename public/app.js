document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const eventsList = document.getElementById('events-list');
    const emptyState = document.getElementById('empty-state');
    const noSelectionView = document.getElementById('no-selection');
    const eventDetailsView = document.getElementById('event-details');
    const endpointUrlEl = document.getElementById('endpoint-url');
    const copyBtn = document.getElementById('copy-btn');
    const toast = document.getElementById('toast');

    // Detail View Elements
    const detailTime = document.getElementById('detail-time');
    const detailId = document.getElementById('detail-id');
    const cardDealer = document.getElementById('card-dealer');
    const cardDms = document.getElementById('card-dms');
    const cardTemplate = document.getElementById('card-template');
    const cardStore = document.getElementById('card-store');
    const jsonViewer = document.getElementById('json-viewer');
    const zplViewer = document.getElementById('zpl-viewer');
    const zplSection = document.getElementById('zpl-section');

    // State
    let webhooks = [];
    let stateActiveEventId = null;

    // Initialize Host URL
    const currentHost = window.location.origin;
    endpointUrlEl.textContent = `${currentHost}/api/event/zpl-webhook`;

    // Copy to clipboard functionality
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(endpointUrlEl.textContent).then(() => {
            showToast();
        });
    });

    function showToast() {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ------------------------------------------------------------------
    // Base64 Decode Helper
    // ------------------------------------------------------------------
    function decodeBase64(b64String) {
        try {
            return atob(b64String);
        } catch (e) {
            console.error('Base64 decode failed:', e);
            return '[Unable to decode ZPL data]';
        }
    }

    // ------------------------------------------------------------------
    // Server-Sent Events (SSE) Connection
    // ------------------------------------------------------------------
    function setupSSE() {
        console.log('Connecting to SSE stream...');
        const eventSource = new EventSource('/api/stream');

        eventSource.addEventListener('initial_data', (e) => {
            const data = JSON.parse(e.data);
            console.log('Received initial history:', data);
            webhooks = data;
            renderEventList();
        });

        eventSource.addEventListener('new_webhook', (e) => {
            const newEvent = JSON.parse(e.data);
            console.log('Received new event:', newEvent);
            webhooks.unshift(newEvent);
            if (webhooks.length > 50) webhooks.pop();
            renderEventList();
        });

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
        };
    }

    setupSSE();

    // ------------------------------------------------------------------
    // Rendering Logic
    // ------------------------------------------------------------------
    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            + ' - ' + date.toLocaleDateString();
    }

    function renderEventList() {
        if (webhooks.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        const items = eventsList.querySelectorAll('.event-item');
        items.forEach(item => item.remove());

        webhooks.forEach(item => {
            const isSelected = item.id === stateActiveEventId;

            // Extract info from either the new batched format or the old format
            const labelsArray = Array.isArray(item.body?.labels) ? item.body.labels : [item.body || {}];
            const firstLabel = labelsArray[0] || {};
            
            const dealer = firstLabel.dealer_id || firstLabel.dealerId || 'Unknown';
            const store = firstLabel.store_name || 'Unknown Store';
            let template = firstLabel.template_name || 'Unknown';
            
            if (labelsArray.length > 1) {
                template = `${template} (+${labelsArray.length - 1} more)`;
            }

            const itemEl = document.createElement('div');
            itemEl.className = `event-item ${isSelected ? 'active' : ''}`;
            itemEl.dataset.id = item.id;

            itemEl.innerHTML = `
                <div class="event-item-header">
                    <span class="method-badge">POST</span>
                    <span class="event-time">${formatTime(item.timestamp)}</span>
                </div>
                <div class="event-title">${store} — Dealer: ${dealer}</div>
                <div class="event-subtitle">Template: ${template}</div>
            `;

            itemEl.addEventListener('click', () => {
                selectEvent(item.id);
            });

            eventsList.appendChild(itemEl);
        });
    }

    function selectEvent(id) {
        stateActiveEventId = id;

        document.querySelectorAll('.event-item').forEach(el => {
            if (el.dataset.id === id) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        const selectedEvent = webhooks.find(w => w.id === id);
        if (!selectedEvent) return;

        noSelectionView.classList.add('hide');
        eventDetailsView.classList.remove('hide');

        detailTime.textContent = formatTime(selectedEvent.timestamp);
        detailId.textContent = `ID: ${selectedEvent.id}`;

        // Support both old and new field names (Batched arrays or single payload)
        const labelsArray = Array.isArray(selectedEvent.body?.labels) ? selectedEvent.body.labels : [selectedEvent.body || {}];
        const firstLabel = labelsArray[0] || {};

        document.getElementById('card-dealer').textContent = firstLabel.dealer_id || firstLabel.dealerId || '-';
        document.getElementById('card-dms').textContent = firstLabel.dms_account_id || firstLabel.dmsAccountId || '-';
        document.getElementById('card-store').textContent = firstLabel.store_name
            ? `${firstLabel.store_name} :${firstLabel.store_port || ''}`
            : '-';
        
        // Calculate the actual number of labels based on content
        let actualLabelCount = 0;
        labelsArray.forEach(lbl => {
            let decodedZpl = '';
            if (lbl.zpl_data) {
                decodedZpl = decodeBase64(lbl.zpl_data);
            } else if (lbl.rawZpl) {
                decodedZpl = lbl.rawZpl;
            }
            
            if (decodedZpl) {
                const zplMatches = decodedZpl.match(/\^XA/gi);
                const tsplMatches = decodedZpl.match(/SIZE /gi);
                if (zplMatches) actualLabelCount += zplMatches.length;
                else if (tsplMatches) actualLabelCount += tsplMatches.length;
                else actualLabelCount += 1;
            } else {
                actualLabelCount += 1;
            }
        });

        document.getElementById('card-count').textContent = actualLabelCount || labelsArray.length;

        // Use the original payload so the user can see everything exactly as received
        const displayPayload = selectedEvent;

        const fullJsonString = JSON.stringify(displayPayload, null, 2);
        jsonViewer.textContent = fullJsonString;
        
        // Disable syntax highlighting on extremely large payloads to prevent UI freezing
        if (fullJsonString.length < 100000) {
            jsonViewer.removeAttribute('data-highlighted');
            hljs.highlightElement(jsonViewer);
        }

        // Render dynamic ZPL blocks and Labelary previews
        const labelsContainer = document.getElementById('labels-container');
        labelsContainer.innerHTML = ''; // clear previous

        labelsArray.forEach((lbl, index) => {
            const zplB64 = lbl.zpl_data;
            const rawZpl = lbl.rawZpl;
            let decodedZpl = '';

            if (zplB64) {
                decodedZpl = decodeBase64(zplB64);
            } else if (rawZpl) {
                decodedZpl = rawZpl;
            }

            if (!decodedZpl) return;

            const labelSection = document.createElement('div');
            labelSection.className = 'payload-section zpl-section';
            
            const templateHtml = lbl.template_name 
                ? `<span style="margin-left: 1rem; font-size: 0.9rem; color: var(--text-muted);">Template: ${lbl.template_name} (${lbl.fingerprint || ''})</span>` 
                : '';

            labelSection.innerHTML = `
                <div class="section-header">
                    <h3>Label ${index + 1} Payload Decoded ${templateHtml}</h3>
                </div>

                <div class="code-container">
                    <pre><code class="language-plaintext">${decodedZpl}</code></pre>
                </div>
            `;

            labelsContainer.appendChild(labelSection);
        });
    }
});
