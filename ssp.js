(function () {
    // Funzione per estrarre i dati e generare la tabella
    function extractAndDisplayTable() {
        // Seleziona tutti gli elementi con classe .DataTables_sort_wrapper
        const dataRows = document.querySelectorAll('.DataTables_sort_wrapper');

        if (!dataRows.length) {
            console.error("Nessun dato trovato con la classe '.DataTables_sort_wrapper'. Verifica la struttura della pagina.");
            return;
        }

        // Array per memorizzare i dati
        const extractedData = [];

        dataRows.forEach(row => {
            // Trova i dati relativi a SDT e CPT nella stessa riga
            const sdtElement = row.closest('tr')?.querySelector('.SDT-selector'); // Modifica con il selettore corretto per SDT
            const cptElement = row.closest('tr')?.querySelector('.CPT-selector'); // Modifica con il selettore corretto per CPT

            // Aggiungi i dati all'array
            extractedData.push({
                dataTable: row.textContent.trim(),
                sdt: sdtElement ? sdtElement.textContent.trim() : 'N/A',
                cpt: cptElement ? cptElement.textContent.trim() : 'N/A'
            });
        });

        // Genera la tabella
        createTable(extractedData);
    }

    // Funzione per creare e visualizzare la tabella
    function createTable(data) {
        // Rimuovi eventuali tabelle precedenti
        const existingTable = document.querySelector('#extractedDataTable');
        if (existingTable) {
            existingTable.remove();
        }

        // Crea la tabella
        const table = document.createElement('table');
        table.id = 'extractedDataTable';
        table.style.border = '1px solid black';
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.marginTop = '20px';

        // Crea l'intestazione
        const headerRow = document.createElement('tr');
        ['DataTable', 'SDT', 'CPT'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.border = '1px solid black';
            th.style.padding = '8px';
            th.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // Popola la tabella con i dati
        data.forEach(item => {
            const tr = document.createElement('tr');
            Object.values(item).forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                td.style.border = '1px solid black';
                td.style.padding = '8px';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        // Aggiungi la tabella al DOM
        document.body.appendChild(table);
    }

    // Esegui la funzione di estrazione e creazione tabella
    extractAndDisplayTable();
})();
