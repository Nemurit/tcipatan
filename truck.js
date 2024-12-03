(async function () {
    'use strict';

    console.log('Inizio script per l\'estrazione dati dalla tabella #dashboard.');

    // Funzione principale
    async function main() {
        // Aspetta che la tabella con ID `dashboard` venga aggiunta al DOM
        try {
            const table = await waitForElement('table#dashboard');
            console.log('Tabella trovata, inizio estrazione dati.');

            // Estrai i dati dalla tabella
            const rows = extractTableData(table);
            console.log(`Dati estratti (${rows.length} righe):`, rows);

            // (Facoltativo) Mostra i dati in una tabella personalizzata o gestiscili
            showDataInConsole(rows);

        } catch (error) {
            console.error('Errore durante il caricamento della tabella:', error);
        }
    }

    // Aspetta un elemento specifico nel DOM
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect(); // Disabilita l'osservatore
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout: L'elemento ${selector} non è stato trovato.`));
            }, timeout);
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

    // Mostra i dati nella console
    function showDataInConsole(rows) {
        console.table(rows, ['lane', 'sdt', 'cpt', 'vrId']);
    }

    // Avvia lo script
    await main();
})();
