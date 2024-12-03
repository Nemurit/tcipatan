(function () {
    'use strict';

    // Variabili globali
    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;

    // Stato della visibilità della tabella
    let isTableVisible = false;

    // Costanti
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;
    const REFRESH_INTERVAL = 10 * 60 * 1000; // Intervallo di 10 minuti
    const REFRESH_DELAY = 15 * 1000; // Ritardo di 15 secondi per il caricamento

    // Timer per il refresh automatico
    let refreshInterval = null;

    // Funzione per impostare il refresh automatico
    function setupAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(() => {
            if (isTableVisible) {
                console.log('Eseguendo refresh automatico...');
                loadIframeAndWait(DEFAULT_HOURS);
            }
        }, REFRESH_INTERVAL);
    }

    // Funzione per creare il pulsante di caricamento dati con funzione toggle
    function createButtonForPageLoadAndDataExtraction() {
        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', function () {
            if (isTableVisible) {
                // Nascondi la tabella e resetta lo stato
                if (tableContainer) {
                    tableContainer.style.display = 'none';
                }
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                // Mostra la tabella e carica i dati
                if (tableContainer) {
                    tableContainer.style.display = 'block';
                } else {
                    loadIframeAndWait(INITIAL_HOURS); // Carica dati per il massimo di 1 ora
                }
                button.innerHTML = 'Nascondi TRUCKS';
                isTableVisible = true;
            }
        });

        return button;
    }

    // Funzione per caricare e aggiornare i dati dall'iframe
    function loadIframeAndWait(hours) {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none';
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?';
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            setTimeout(() => {
                adjustTableRowSelection(iframe);
                extractDataFromIframe(iframe, hours);
            }, REFRESH_DELAY); // Aspetta 15 secondi per garantire il caricamento
        };
    }

    // Funzione per aggiornare la selezione delle righe della tabella nell'iframe
    function adjustTableRowSelection(iframe) {
        const iframeDoc = iframe.contentWindow.document;
        const dropdown = iframeDoc.querySelector('#dashboard_length select');

        if (dropdown) {
            dropdown.value = '100';
            const event = new Event('change', { bubbles: true });
            dropdown.dispatchEvent(event);
            console.log('Selezione righe impostata a 100.');
        } else {
            console.log('Dropdown per la selezione righe non trovato.');
        }
    }

    // Funzione per estrarre i dati dalla tabella nell'iframe
    function extractDataFromIframe(iframe, hours) {
        const iframeDoc = iframe.contentWindow.document;
        const targetTable = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');

        if (targetTable) {
            const tbody = targetTable.querySelector('tbody');
            if (tbody) {
                const rows = Array.from(tbody.querySelectorAll('tr'));

                allRows = rows.map((row, index) => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length >= 15) {
                        const sdt = tds[13].textContent.trim();
                        const cpt = tds[14].textContent.trim();
                        const lane = tds[5].textContent.trim();
                        const vrId = tds[7].textContent.trim();

                        const rowDate = parseDate(sdt);

                        if (!rowDate) {
                            console.error(`Errore nel parsing della data: ${sdt}`);
                            return null;
                        }

                        let extraText = 'COLLECTION';
                        let highlightColor = 'orange';
                        if (sdt === cpt) {
                            extraText = 'CPT';
                            highlightColor = 'green';
                        }
                        if (lane.startsWith('WT')) {
                            extraText = 'TRANSFER';
                            highlightColor = 'violet';
                        }

                        return {
                            index: index + 1,
                            lane: lane,
                            sdt: sdt,
                            cpt: cpt,
                            vrId: vrId,
                            date: rowDate,
                            extraText: extraText,
                            highlightColor: highlightColor,
                        };
                    }
                }).filter(Boolean);

                showButtonsAndInputs();
                filterAndShowData(hours);
            } else {
                console.log('Il <tbody> non è stato trovato nella tabella.');
            }
        } else {
            console.log('La tabella non è stata trovata.');
        }
    }

    // Inizializza i pulsanti e gli input
    createButtons();

    // Avvia il refresh automatico
    setupAutoRefresh();

})();
