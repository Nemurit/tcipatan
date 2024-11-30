(function () {
    'use strict';

    // Cambia il titolo della pagina
    document.title = "CLERK HANDOVER";

    let tableContainer = null;
    let allRows = [];

    // Funzione per creare i pulsanti e posizionarli
    function createButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'fixed';
        buttonContainer.style.top = '10px';
        buttonContainer.style.left = '10px';
        buttonContainer.style.zIndex = '10001';
        buttonContainer.style.display = 'flex';

        // Pulsante "Visualizza TRUCKS"
        const trucksButton = document.createElement('button');
        trucksButton.innerHTML = 'Visualizza TRUCKS';
        trucksButton.style.padding = '8px';
        trucksButton.style.backgroundColor = '#4CAF50';
        trucksButton.style.color = 'white';
        trucksButton.style.border = 'none';
        trucksButton.style.borderRadius = '5px';
        trucksButton.style.marginRight = '10px';
        trucksButton.addEventListener('click', function () {
            console.log('Pulsante Visualizza TRUCKS cliccato.');
            loadIframeAndExtractData(); // Carica iframe e avvia estrazione dati
        });

        // Pulsante "Visualizza Recuperi"
        const recoveriesButton = document.createElement('button');
        recoveriesButton.innerHTML = 'Visualizza Recuperi';
        recoveriesButton.style.padding = '8px';
        recoveriesButton.style.backgroundColor = '#007bff';
        recoveriesButton.style.color = 'white';
        recoveriesButton.style.border = 'none';
        recoveriesButton.style.borderRadius = '5px';
        recoveriesButton.addEventListener('click', function () {
            console.log('Pulsante Visualizza Recuperi cliccato.');
            alert('Funzionalità Recuperi in fase di implementazione.');
        });

        // Aggiungi i pulsanti al contenitore
        buttonContainer.appendChild(trucksButton);
        buttonContainer.appendChild(recoveriesButton);

        // Aggiungi il contenitore al corpo della pagina
        document.body.appendChild(buttonContainer);
    }

    // Funzione per creare un iframe e caricarlo
    function loadIframeAndExtractData() {
        let iframe = document.getElementById('pageIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pageIframe';
            iframe.style.display = 'none'; // Nascondi iframe per ora
            iframe.src = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob?'; // URL dell'iframe
            document.body.appendChild(iframe);
        }

        iframe.onload = function () {
            console.log('Iframe caricato.');
            // Controlla se è possibile accedere ai dati
            try {
                const iframeDoc = iframe.contentWindow.document;
                if (!iframeDoc) {
                    console.error('Impossibile accedere al documento dell\'iframe.');
                    return;
                }
                console.log('Documento dell\'iframe accessibile.');
                extractDataFromIframe(iframeDoc);
            } catch (error) {
                console.error('Errore nell\'accesso all\'iframe:', error);
            }
        };
    }

    // Estrai dati dalla tabella dell'iframe
    function extractDataFromIframe(iframeDoc) {
        const table = iframeDoc.querySelector('table#dashboard.display.dataTable.floatL');
        if (!table) {
            console.error('Tabella non trovata nell\'iframe.');
            return;
        }

        const rows = Array.from(table.querySelectorAll('tbody tr'));
        allRows = rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 15) {
                return {
                    lane: cells[5].textContent.trim(),
                    sdt: cells[13].textContent.trim(),
                    cpt: cells[14].textContent.trim(),
                };
            }
            return null;
        }).filter(Boolean);

        console.log('Dati estratti:', allRows);
        displayDataInTable(allRows);
    }

    // Visualizza i dati in una tabella
    function displayDataInTable(data) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.style.position = 'fixed';
        tableContainer.style.top = '40px';
        tableContainer.style.right = '10px';
        tableContainer.style.zIndex = '10001';
        tableContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        tableContainer.style.padding = '15px';
        tableContainer.style.maxHeight = '400px';
        tableContainer.style.overflowY = 'scroll';
        tableContainer.style.width = '30%';
        tableContainer.style.border = '1px solid #ccc';
        tableContainer.style.borderRadius = '5px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>LANE</th>
                    <th>SDT</th>
                    <th>CPT</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        <td>${row.lane}</td>
                        <td>${row.sdt}</td>
                        <td>${row.cpt}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    // Inizializza i pulsanti
    createButtons();
})();
