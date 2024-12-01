(async function () {
    const URL = 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob'; // URL della pagina da analizzare

    try {
        const response = await fetch(URL, {
            method: 'GET',
            headers: {
                'Accept': 'text/html',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Errore: ${response.status}`);
        }

        const html = await response.text();

        // Crea un DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Attendere 5 secondi prima di cercare la tabella
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Cerca direttamente la tabella con id="dashboard"
        const targetTable = doc.querySelector('table#dashboard');
        if (!targetTable) {
            throw new Error('Tabella con id="dashboard" non trovata nella pagina.');
        }

        // Estrarre righe dalla tabella
        const rows = Array.from(targetTable.querySelectorAll('tbody tr')).map((row, index) => {
            const cells = row.querySelectorAll('td');
            return {
                index: index + 1,
                lane: cells[5]?.textContent.trim() || 'N/A',
                sdt: cells[13]?.textContent.trim() || 'N/A',
                cpt: cells[14]?.textContent.trim() || 'N/A',
            };
        });

        displayDataAsTable(rows);
    } catch (error) {
        console.error('Errore:', error);
    }

    // Mostra i dati in una tabella HTML
    function displayDataAsTable(rows) {
        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.backgroundColor = '#f9f9f9';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '5px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Lane</th>
                    <th>SDT</th>
                    <th>CPT</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${row.index}</td>
                        <td>${row.lane}</td>
                        <td>${row.sdt}</td>
                        <td>${row.cpt}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        container.appendChild(table);
        document.body.appendChild(container);
    }
})();
