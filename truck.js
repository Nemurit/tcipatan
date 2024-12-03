(async function () {
    'use strict';

    // URL della pagina o endpoint API per i dati della tabella
    const apiUrl = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob';

    // Funzione principale per avviare il processo
    async function main() {
        console.log('Inizio estrazione dati...');

        try {
            // Esegui una richiesta GET per ottenere i dati
            const response = await fetch(apiUrl, {
                method: 'GET',
                credentials: 'include', // Invia cookie/sessione
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                },
            });

            // Controlla se la risposta è valida
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }

            // Estrai il contenuto come testo HTML
            const htmlText = await response.text();

            // Crea un DOMParser per analizzare l'HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            // Aspetta che la tabella venga generata
            const table = await waitForTable(doc, 'table#dashboard');

            // Estrai i dati dalla tabella
            const rows = extractTableData(table);
            console.log(`Dati estratti (${rows.length} righe):`, rows);

        } catch (error) {
            console.error('Errore durante il fetch dei dati:', error);
        }
    }

    // Aspetta che una tabella specifica sia presente nel DOM
    function waitForTable(doc, tableSelector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function checkTable() {
                const table = doc.querySelector(tableSelector);
                if (table) {
                    resolve(table);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout: La tabella non è stata trovata.'));
                } else {
                    setTimeout(checkTable, 500);
                }
            }

            checkTable();
        });
    }

    // Estrai i dati da una tabella HTML
    function extractTableData(table) {
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                lane: cells[5]?.textContent.trim(),
                sdt: cells[13]?.textContent.trim(),
                cpt: cells[14]?.textContent.trim(),
                vrId: cells[7]?.textContent.trim(),
            };
        });
    }

    // Avvia lo script
    await main();
})();
