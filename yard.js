(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    // Funzione per caricare la pagina di yard in un iframe nascosto con attesa di 5 secondi
    function loadYardPageAndExtractData(callback) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none'; // Nasconde l'iframe
        iframe.src = "https://trans-logistics-eu.amazon.com/yms/shipclerk/#/yard";

        iframe.onload = function () {
            setTimeout(() => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (!iframeDoc) {
                    console.error("Impossibile accedere al contenuto dell'iframe.");
                    callback([]);
                    return;
                }

                // Seleziona tutte le righe
                const rows = iframeDoc.querySelectorAll('tr');
                const data = [];

                rows.forEach(row => {
                    const hasCol1 = row.querySelector('td.col1') !== null; // Verifica se esiste "col1"
                    const noteContainer = row.querySelector('#noteContainer'); // Verifica se esiste "noteContainer"

                    if (hasCol1 && noteContainer) {
                        const noteText = noteContainer.innerText.trim();

                        // Verifica se "noteContainer" contiene "JP" o "Ricarica" (case-insensitive)
                        if (/jp|ricarica/i.test(noteText)) {
                            const cells = row.querySelectorAll('td');
                            if (cells.length > 0) {
                                const firstCell = cells[0].innerText.trim(); // Primo <td>
                                const lastCell = cells[cells.length - 1].innerText.trim(); // Ultimo <td>
                                data.push([firstCell, lastCell]); // Salva solo primo e ultimo
                            }
                        }
                    }
                });

                console.log("Dati filtrati:", data);
                callback(data);

                // Rimuove l'iframe dopo l'elaborazione
                iframe.remove();
            }, 1500); // Aspetta 5 secondi
        };

        document.body.appendChild(iframe);
    }

    // Funzione per visualizzare i dati in una tabella HTML direttamente nel body
    function displayData(data) {
        console.log("Displaying data:", data); // Log dei dati caricati
        // Verifica se ci sono dati
        if (data.length === 0) {
            alert("Nessun dato disponibile!");
            return;
        }

        // Crea una tabella per visualizzare i dati
        const dataTable = document.createElement('table');
        dataTable.style.borderCollapse = 'collapse';
        dataTable.style.fontSize = '14px';
        dataTable.style.fontFamily = 'Arial, sans-serif';
        dataTable.style.textAlign = 'left';
        dataTable.style.border = '1px solid #ddd';
        dataTable.style.width = 'auto'; // Adattamento alla lunghezza del contenuto

        const thead = dataTable.createTHead();
        const tbody = dataTable.createTBody();

        // Intestazione
        const headerRow = thead.insertRow();
        const th1 = document.createElement('th');
        th1.textContent = "Primo TD";
        headerRow.appendChild(th1);

        const th2 = document.createElement('th');
        th2.textContent = "Ultimo TD";
        headerRow.appendChild(th2);

        [th1, th2].forEach(th => {
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f4f4f4';
            th.style.color = '#333';
        });

        // Aggiungi le righe dei dati
        data.forEach(rowData => {
            const row = tbody.insertRow();

            const firstTd = row.insertCell();
            firstTd.textContent = rowData[0];

            const lastTd = row.insertCell();
            lastTd.textContent = rowData[1];

            [firstTd, lastTd].forEach(td => {
                td.style.padding = '8px';
                td.style.border = '1px solid #ddd';
                td.style.whiteSpace = 'nowrap'; // Impedisce il wrapping per rispettare la lunghezza della stringa
            });
        });

        // Aggiungi la tabella direttamente al body della pagina
        document.body.appendChild(dataTable); // Invece di aggiungerla al container
    }

    // Funzione per mostrare/nascondere i dati al clic del pulsante
    function toggleDataDisplay() {
        if (tableVisible) {
            // Se la tabella è visibile, nascondi
            const tables = document.querySelectorAll('table');
            tables.forEach(table => table.style.display = 'none');
        } else {
            // Carica e mostra i dati solo se i dati non sono ancora stati caricati
            if (!isDataLoaded) {
                loadYardPageAndExtractData(function (data) {
                    console.log("Dati caricati per la tabella:", data);
                    displayData(data);
                });
            } else {
                // Se i dati sono già stati caricati, mostra semplicemente la tabella
                const tables = document.querySelectorAll('table');
                tables.forEach(table => table.style.display = 'block');
            }
        }
        tableVisible = !tableVisible; // Inverti lo stato della visibilità
    }

    // Crea il pulsante "Mostra dati veicoli"
    const button = document.createElement('button');
    button.textContent = "Mostra dati veicoli";
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

    // Aggiungi evento click al pulsante
    button.addEventListener('click', toggleDataDisplay);

    // Aggiungi il pulsante alla pagina
    document.body.appendChild(button);
})();
