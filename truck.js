(async function () {
    'use strict';

    // URL della pagina che contiene la tabella dinamica
    const targetUrl = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob';

    // Funzione principale per avviare il processo
    async function main() {
        console.log('Caricamento dati da /ob...');
        
        // Crea un iframe invisibile per caricare la pagina
        const iframe = createHiddenIframe(targetUrl);

        // Aspetta il caricamento dell'iframe e ottieni il suo documento
        const iframeDoc = await waitForIframeLoad(iframe);

        // Aspetta che la tabella venga popolata dinamicamente
        const table = await waitForTableLoad(iframeDoc, 'table#dashboard');

        // Estrai i dati dalla tabella
        const rows = extractTableData(table);
        console.log('Dati estratti:', rows);

        // Rimuovi l'iframe per pulizia
        iframe.remove();

        // Visualizza i dati in console o utilizzali come necessario
        console.log(`Dati estratti (${rows.length} righe):`, rows);
    }

    // Crea un iframe nascosto
    function createHiddenIframe(url) {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        return iframe;
    }

    // Aspetta il caricamento dell'iframe
    function waitForIframeLoad(iframe) {
        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    resolve(iframeDoc);
                } else {
                    reject(new Error('Impossibile accedere al contenuto dell\'iframe.'));
                }
            };
        });
    }

    // Aspetta che una tabella specifica venga caricata
    function waitForTableLoad(doc, tableSelector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function checkTable() {
                const table = doc.querySelector(tableSelector);
                if (table) {
                    resolve(table);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout: La tabella non è stata caricata.'));
                } else {
                    setTimeout(checkTable, 500);
                }
            }

            checkTable();
        });
    }

    // Estrai i dati da una tabella
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
    try {
        await main();
    } catch (error) {
        console.error('Errore durante l\'esecuzione:', error);
    }
})();
