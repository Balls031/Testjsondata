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

            // Extract info from the new payload format
            const dealer = item.body?.dealer_id || item.body?.dealerId || 'Unknown';
            const store = item.body?.store_name || 'Unknown Store';
            const template = item.body?.template_name || '';

            const itemEl = document.createElement('div');
            itemEl.className = `event-item ${isSelected ? 'active' : ''}`;
            itemEl.dataset.id = item.id;

            itemEl.innerHTML = `
                <div class="event-item-header">
                    <span class="method-badge">POST</span>
                    <span class="event-time">${formatTime(item.timestamp)}</span>
                </div>
                <div class="event-title">${store} — Dealer: ${dealer}</div>
                <div class="event-subtitle">Template: ${template || 'N/A'}</div>
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

        // Populate Cards — support both old and new field names
        cardDealer.textContent = selectedEvent.body?.dealer_id || selectedEvent.body?.dealerId || '-';
        cardDms.textContent = selectedEvent.body?.dms_account_id || selectedEvent.body?.dmsAccountId || '-';
        cardTemplate.textContent = selectedEvent.body?.template_name
            ? `${selectedEvent.body.template_name} (${selectedEvent.body.fingerprint || ''})`
            : '-';
        cardStore.textContent = selectedEvent.body?.store_name
            ? `${selectedEvent.body.store_name} :${selectedEvent.body.store_port || ''}`
            : '-';

        // Build a display copy of the payload without the huge base64 blob
        const displayPayload = JSON.parse(JSON.stringify(selectedEvent));
        if (displayPayload.body?.zpl_data) {
            displayPayload.body.zpl_data = `[Base64 — ${displayPayload.body.zpl_data.length} chars — see decoded ZPL below]`;
        }

        const fullJsonString = JSON.stringify(displayPayload, null, 2);
        jsonViewer.textContent = fullJsonString;
        jsonViewer.removeAttribute('data-highlighted');
        hljs.highlightElement(jsonViewer);

        // Handle raw ZPL Preview — decode from Base64
        const zplB64 = selectedEvent.body?.zpl_data;
        const rawZpl = selectedEvent.body?.rawZpl;

        if (zplB64) {
            zplSection.classList.remove('hide');
            zplViewer.textContent = decodeBase64(zplB64);
        } else if (rawZpl) {
            zplSection.classList.remove('hide');
            zplViewer.textContent = rawZpl;
        } else {
            zplSection.classList.add('hide');
            zplViewer.textContent = '';
        }
    }
});
