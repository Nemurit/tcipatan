(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];  // Ora permette un array di lane
    let stackingToLaneMap = {};
    let isVisible = false;  // Variabile per tenere traccia della visibilità della tabella

    function fetchStackingFilterMap(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: stackingFilterMapUrl,
            onload: function(response) {
                try {
                    const laneData = JSON.parse(response.responseText);

                    for (const [lane, stackingFilters] of Object.entries(laneData)) {
                        stackingFilters.forEach(filter => {
                            stackingToLaneMap[filter] = lane.split('[')[0];
                        });
                    }

                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing della mappa JSON:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nel caricamento del file JSON:", error);
            }
        });
    }

    function fetchBufferSummary() {
        const endTime = new Date().getTime();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const apiUrl = `https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria`;
        const payload = {
            entity: "getContainersDetailByCriteria",
            nodeId: nodeId,
            timeBucket: {
                fieldName: "physicalLocationMoveTimestamp",
                startTime: startTime,
                endTime: endTime
            },
            filterBy: {
                state: ["Stacked"],
                isClosed: [true],
                isMissing: [false]
            },
            containerTypes: ["PALLET", "GAYLORD", "BAG", "CART"]
        };

        GM_xmlhttpRequest({
            method: "GET",
            url: `${apiUrl}?${new URLSearchParams({ jsonObj: JSON.stringify(payload) })}`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        processAndDisplay(containers);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API.");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nella chiamata API:", error);
            }
        });
    }

    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || location.toUpperCase().includes(selectedBufferFilter.toUpperCase())) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                }

                if (!filteredSummary[lane][location]) {
                    filteredSummary[lane][location] = { count: 0 };
                }

                filteredSummary[lane][location].count++;
            }
        });

        // Ordinamento: prima per numero, poi per lettera
        const sortedSummary = Object.keys(filteredSummary)
            .sort((a, b) => {
                const numA = parseBufferNumber(a); // Estrai numero da A
                const numB = parseBufferNumber(b); // Estrai numero da B

                // Se i numeri sono uguali, ordina per lettera
                if (numA === numB) {
                    return a.localeCompare(b);  // Ordinamento alfabetico per le lettere
                }
                return numA - numB;  // Ordinamento numerico
            })
            .reduce((acc, lane) => {
                acc[lane] = filteredSummary[lane];
                return acc;
            }, {});

        displayTable(sortedSummary);
    }

    // Funzione per estrarre il numero dal nome del buffer (ad esempio "B4", "E3")
    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/(\d+)/); // Trova il numero nella stringa
        return match ? parseInt(match[0], 10) : 0;  // Restituisce il numero trovato
    }

    function displayTable(filteredSummary) {
        if (!isVisible) return;  // Se non è visibile, non fare nulla

        $('#bufferSummaryTable').remove();

        if (Object.keys(filteredSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        table.append('<thead><tr><th>Lane</th><th>Buffer</th><th>Numero di Container</th></tr></thead>');

        const tbody = $('<tbody></tbody>');
        let rowCount = 0;
        let totalContainers = 0;

        // Limita le righe a 5 se non ci sono filtri impostati
        const rowsToShow = (selectedBufferFilter === '' && selectedLaneFilters.length === 0) ? 5 : Infinity;

        Object.entries(filteredSummary).forEach(([lane, buffers]) => {
            // Prima mostra la riga della Lane con il totale
            let laneTotal = 0;
            Object.values(buffers).forEach(buffer => {
                laneTotal += buffer.count;
            });

            const laneRow = $('<tr></tr>');
            laneRow.append(`<td colspan="2" style="font-weight: bold; text-align: center;">Lane: ${lane} (Totale: ${laneTotal})</td>`);
            laneRow.append('<td></td>'); // Lascia vuoto il campo del totale lane
            tbody.append(laneRow);

            // Poi mostra i buffer per quella lane
            Object.entries(buffers).forEach(([location, data]) => {
                const row = $('<tr></tr>');
                row.append(`<td></td>`); // Lascia vuoto il campo lane
                row.append(`<td>${location}</td>`);
                row.append(`<td>${data.count}</td>`);
                tbody.append(row);
                rowCount++;
                totalContainers += data.count;
            });
        });

        const totalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale</td><td>' + totalContainers + '</td></tr>');
        tbody.append(totalRow);

        table.append(tbody);
        $('body').append(table);

        GM_addStyle(`
            #bufferSummaryTable {
                width: 50%;
                margin: 20px 0;
                border-collapse: collapse;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                position: absolute;
                right: 10px;
                top: 70px;  /* Spostato a 70px dal top */
            }
            #bufferSummaryTable th, #bufferSummaryTable td {
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }
            #bufferSummaryTable th {
                background-color: #f4f4f4;
                font-weight: bold;
            }
            #bufferSummaryTable tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            #bufferSummaryTable tr:hover {
                background-color: #f1f1f1;
            }
        `);

        addFilters();
    }

    function addFilters() {
        if (!isVisible) return;  // Non mostrare i filtri se la tabella è nascosta

        $('#filterContainer').remove();

        const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: fixed; top: 10px; right: 10px; z-index: 9999;"></div>');

        const bufferFilterInput = $('<input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        bufferFilterInput.val(selectedBufferFilter);

        bufferFilterInput.on('keydown', function(event) {
            if (event.key === 'Enter') {
                selectedBufferFilter = this.value.trim();
                fetchBufferSummary();
            }
        });

        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtra per Lane (separate da virgola)" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        laneFilterInput.val(selectedLaneFilters.join(','));

        laneFilterInput.on('keydown', function(event) {
            if (event.key === 'Enter') {
                selectedLaneFilters = this.value.split(',').map(filter => filter.trim());
                fetchBufferSummary();
            }
        });

        filterContainer.append(bufferFilterInput);
        filterContainer.append(laneFilterInput);
        $('body').append(filterContainer);

        GM_addStyle(`
            #filterContainer input {
                margin-top: 10px;
                z-index: 10000;
            }
        `);
    }

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: 950px; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Recuperi</button>');

        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();  // Mostra la tabella e i filtri
                $(this).text("Nascondi Recuperi");
            } else {
                $('#filterContainer').remove();  // Nasconde i filtri
                $('#bufferSummaryTable').remove();  // Nasconde la tabella
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(toggleButton);
    }

    addToggleButton();  // Aggiungi il pulsante per mostrare/nascondere
    fetchStackingFilterMap(fetchBufferSummary);  // Carica i dati iniziali
})();
