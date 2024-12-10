(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    function loadYardPageAndExtractData(callback) {
        // Codice per caricare ed estrarre i dati (non modificato)
    }

    function displayData(data) {
        // Codice per visualizzare i dati nella tabella (non modificato)
    }

    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
            printButton.style.display = 'none'; // Nascondi pulsante Stampa
            button.textContent = "Mostra Scarichi";
        } else {
            printButton.style.display = 'block'; // Mostra pulsante Stampa immediatamente
            dataContainer.style.display = 'block'; // Mostra il contenitore (anche se vuoto inizialmente)
            loadYardPageAndExtractData(function (data) {
                displayData(data); // Popola il contenitore
            });
            button.textContent = "Nascondi Scarichi";
        }
        tableVisible = !tableVisible;
    }

    function printContainerContent() {
        // Crea una nuova finestra per stampare il contenuto del container
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error("Impossibile aprire la finestra di stampa.");
            return;
        }

        // Costruisci il contenuto HTML da stampare
        const containerHTML = `
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 20px;
                        }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                        }
                        th, td {
                            text-align: left;
                            padding: 8px;
                            border: 1px solid #ddd;
                        }
                        th {
                            background-color: #f4f4f4;
                        }
                        span {
                            display: inline-block;
                            width: 10px;
                            height: 10px;
                            border-radius: 50%;
                            background-color: green;
                            margin-left: 10px;
                        }
                    </style>
                </head>
                <body>${dataContainer.outerHTML}</body>
            </html>
        `;

        // Scrive il contenuto nella finestra di stampa
        printWindow.document.open();
        printWindow.document.write(containerHTML);
        printWindow.document.close();

        // Avvia la stampa
        printWindow.print();
    }

    // Intervallo di auto-refresh (non modificato)
    setInterval(() => {
        if (tableVisible) {
            console.log("Esecuzione auto-refresh");
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
        }
    }, 10 * 60 * 1000); // 10 minuti

    const button = document.createElement('button');
    button.textContent = "Mostra Scarichi";
    button.style.position = 'fixed';
    button.style.top = '550px';
    button.style.left = '10px';
    button.style.padding = '10px';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';

    const printButton = document.createElement('button');
    printButton.textContent = "Stampa";
    printButton.style.position = 'fixed';
    printButton.style.top = '550px';
    printButton.style.left = '150px';
    printButton.style.padding = '10px';
    printButton.style.backgroundColor = '#28a745';
    printButton.style.color = 'white';
    printButton.style.border = 'none';
    printButton.style.borderRadius = '5px';
    printButton.style.cursor = 'pointer';
    printButton.style.zIndex = '1000';
    printButton.style.display = 'none'; // Inizialmente nascosto
    printButton.addEventListener('click', printContainerContent);

    dataContainer = document.createElement('div');
    dataContainer.style.position = 'fixed';
    dataContainer.style.top = '600px';
    dataContainer.style.left = '10px';
    dataContainer.style.backgroundColor = 'white';
    dataContainer.style.border = '1px solid #ddd';
    dataContainer.style.borderRadius = '5px';
    dataContainer.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    dataContainer.style.padding = '10px';
    dataContainer.style.display = 'none';
    dataContainer.style.zIndex = '999';
    dataContainer.style.maxHeight = '400px'; // Altezza massima del container
    dataContainer.style.overflowY = 'auto'; // Abilita lo scroll verticale
    dataContainer.style.overflowX = 'hidden'; // Impedisce lo scroll orizzontale

    // Aggiungi l'animazione per il lampeggio del pallino verde
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.2; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    button.addEventListener('click', toggleDataDisplay);

    document.body.appendChild(button);
    document.body.appendChild(printButton);
    document.body.appendChild(dataContainer);
})();
