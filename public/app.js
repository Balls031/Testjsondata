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
    const cardFilename = document.getElementById('card-filename');
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
    // Server-Sent Events (SSE) Connection
    // ------------------------------------------------------------------
    function setupSSE() {
        console.log('Connecting to SSE stream...');
        const eventSource = new EventSource('/api/stream');

        // Receives the full history on initial connection
        eventSource.addEventListener('initial_data', (e) => {
            const data = JSON.parse(e.data);
            console.log('Received initial history:', data);
            webhooks = data;
            renderEventList();
        });

        // Receives a single new event as it happens
        eventSource.addEventListener('new_webhook', (e) => {
            const newEvent = JSON.parse(e.data);
            console.log('Received new event:', newEvent);
            // Add to the front of the array
            webhooks.unshift(newEvent);

            // Limit array size locally as well
            if (webhooks.length > 50) webhooks.pop();

            renderEventList();
        });

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            // Browser will automatically attempt to reconnect
        };
    }

    // Start SSE
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

        // Clear existing items but keep the empty state div
        const items = eventsList.querySelectorAll('.event-item');
        items.forEach(item => item.remove());

        // Render each webhook
        webhooks.forEach(item => {
            const isSelected = item.id === stateActiveEventId;

            // Extract info if it exists in body
            const dealer = item.body?.dealerId || 'Unknown Dealer';
            const file = item.body?.filename || 'Unknown File';

            const itemEl = document.createElement('div');
            itemEl.className = `event-item ${isSelected ? 'active' : ''}`;
            itemEl.dataset.id = item.id;

            itemEl.innerHTML = `
                <div class="event-item-header">
                    <span class="method-badge">POST</span>
                    <span class="event-time">${formatTime(item.timestamp)}</span>
                </div>
                <div class="event-title">Dealer: ${dealer}</div>
                <div class="event-subtitle">${file}</div>
            `;

            itemEl.addEventListener('click', () => {
                selectEvent(item.id);
            });

            eventsList.appendChild(itemEl);
        });
    }

    function selectEvent(id) {
        stateActiveEventId = id;

        // Update list UI
        document.querySelectorAll('.event-item').forEach(el => {
            if (el.dataset.id === id) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        const selectedEvent = webhooks.find(w => w.id === id);
        if (!selectedEvent) return;

        // Populate Detail View
        noSelectionView.classList.add('hide');
        eventDetailsView.classList.remove('hide');

        detailTime.textContent = formatTime(selectedEvent.timestamp);
        detailId.textContent = `ID: ${selectedEvent.id}`;

        // Populate Cards
        cardDealer.textContent = selectedEvent.body?.dealerId || '-';
        cardDms.textContent = selectedEvent.body?.dmsAccountId || '-';
        cardFilename.textContent = selectedEvent.body?.filename || '-';

        // Handle JSON highlighting
        const fullJsonString = JSON.stringify(selectedEvent, null, 2);
        jsonViewer.textContent = fullJsonString;

        // Clear previous highlighting classes
        jsonViewer.removeAttribute('data-highlighted');
        hljs.highlightElement(jsonViewer);

        // Handle raw ZPL Preview if it exists
        if (selectedEvent.body?.rawZpl) {
            zplSection.classList.remove('hide');
            zplViewer.textContent = selectedEvent.body.rawZpl;
        } else {
            zplSection.classList.add('hide');
            zplViewer.textContent = '';
        }
    }
});
