(function () {
    'use strict';

    // Cambia il titolo della pagina
    document.title = "CLERK HANDOVER";

    let tableContainer = null;
    let allRows = [];
    let dropdown = null;
    let timeInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let vrIdInputBox = null;
    let containermain = null;

    // Costanti
    const DEFAULT_HOURS = 1;
    const INITIAL_HOURS = 1;
    const MAX_HOURS = 24;
    const REFRESH_INTERVAL = 60000; // 60 secondi

    // Timer per il refresh automatico
    let refreshInterval = null;
    let isTableVisible = false; // Variabile per gestire la visibilità della tabella

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

    function createButtons() {
        containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.padding = '10px';
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.borderRadius = '5px';
        containermain.style.display = 'flex';
        containermain.style.flexDirection = 'row';

        containermain.appendChild(createButtonForPageLoadAndDataExtraction());

        dropdown = document.createElement('select');
        dropdown.style.display = 'none';
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['Tutti', 'CPT', 'COLLECTION', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });

        dropdown.addEventListener('change', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
        });

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.padding = '3px';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.style.display = 'none';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.style.padding = '3px';
        vrIdInputBox.style.marginRight = '5px';
        vrIdInputBox.style.display = 'none';
        vrIdInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : INITIAL_HOURS);
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.marginRight = '5px';
        printButton.style.display = 'none';

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '5px';
        rowCountDisplay.style.display = 'none';

        containermain.appendChild(dropdown);
        containermain.appendChild(timeInputBox);
        containermain.appendChild(vrIdInputBox);
        containermain.appendChild(printButton);
        containermain.appendChild(rowCountDisplay);

        document.body.appendChild(containermain);
    }

    createButtons();
})();
