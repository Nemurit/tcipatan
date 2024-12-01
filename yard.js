(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    // Funzione per caricare la pagina di yard in un iframe nascosto con attesa di 5 secondi
    function loadYardPageAndExtractData(callback) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none'; // Nasconde l'iframe
        iframe.src = "https://trans-logistics-eu.amazon.com/yms/shipclerk";

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
                    const col9 = row.querySelector('td.col9'); // Verifica se esiste "col9"

                    if ((hasCol1 && noteContainer) || (col9 && /TransfersCarts/i.test(col9.innerText))) {
                        const noteText = noteContainer?.innerText.trim() || "";

                        // Verifica se "noteContainer" contiene "JP" o "Ricarica" (case-insensitive)
                        if (/jp|ricarica/i.test(noteText) || (col9 && /TransfersCarts/i.test(col9.innerText))) {
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
            }, 3000); // Aspetta 5 secondi
        };

        document.body.appendChild(iframe);
    }

    // Funzione per visualizzare i dati in una tabella HTML all'interno del container
    function displayData(data) {
        // Pulisci il contenuto del container
        dataContainer.innerHTML = "";

        if (data.length === 0) {
            const noDataMessage = document.createElement('p');
            noDataMessage.textContent = "Nessun dato disponibile!";
            noDataMessage.style.color = '#333';
            noDataMessage.style.fontFamily = 'Arial, sans-serif';
            dataContainer.appendChild(noDataMessage);
            isDataLoaded = false;
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
        th1.textContent = "Location";
        headerRow.appendChild(th1);

        const th2 = document.createElement('th');
        th2.textContent = "Content";
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

        dataContainer.appendChild(dataTable); // Aggiungi la tabella al container

        // Impostiamo il flag che i dati sono stati caricati
        isDataLoaded = true;

        // Mostra il container dopo che i dati sono stati caricati
        dataContainer.style.display = 'block';
    }

    // Funzione per mostrare/nascondere i dati al clic del pulsante
    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
        } else {
            // Carica e mostra i dati solo se i dati non sono ancora stati caricati
            if (!isDataLoaded) {
                loadYardPageAndExtractData(function (data) {
                    displayData(data);
                });
            } else {
                // Se i dati sono già stati caricati, mostra semplicemente la tabella
                dataContainer.style.display = 'block';
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

    // Crea il container per i dati
    dataContainer = document.createElement('div');
    dataContainer.style.position = 'fixed';
    dataContainer.style.top = '600px';
    dataContainer.style.left = '10px';
    dataContainer.style.backgroundColor = 'white';
    dataContainer.style.border = '1px solid #ddd';
    dataContainer.style.borderRadius = '5px';
    dataContainer.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    dataContainer.style.padding = '10px';
    dataContainer.style.display = 'none'; // Nascondi inizialmente
    dataContainer.style.zIndex = '999';

    // Aggiungi evento click al pulsante
    button.addEventListener('click', toggleDataDisplay);

    // Aggiungi il pulsante e il container alla pagina
    document.body.appendChild(button);
    document.body.appendChild(dataContainer);
})();
