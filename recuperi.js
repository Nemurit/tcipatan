(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let isVisible = false;

    // Funzione per caricare i dati dalla mappa dei filtri
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

    // Funzione per caricare i dati dei container
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
            containerTypes: ["PALLET", "GAYLORD", "CART"]
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

    // Funzione per processare i dati dei container
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
        const sortedSummary = {};
        Object.keys(filteredSummary).forEach(lane => {
            const laneSummary = filteredSummary[lane];
            sortedSummary[lane] = Object.keys(laneSummary)
                .sort((a, b) => {
                    const numA = parseBufferNumber(a); // Estrai numero da A
                    const numB = parseBufferNumber(b); // Estrai numero da B

                    // Se i numeri sono uguali, ordina per lettera
                    if (numA === numB) {
                        return a.localeCompare(b);  // Ordinamento alfabetico per le lettere
                    }
                    return numA - numB;  // Ordinamento numerico
                })
                .reduce((acc, location) => {
                    acc[location] = laneSummary[location];
                    return acc;
                }, {});
        });

        displayTable(sortedSummary);
    }

    // Funzione per estrarre il numero dal nome del buffer (ad esempio "B4", "E3")
    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/(\d+)/); // Trova il numero nella stringa
        return match ? parseInt(match[0], 10) : 0;  // Restituisce il numero trovato
    }

    // Funzione per visualizzare la tabella
    function displayTable(sortedSummary) {
        if (!isVisible) return;

        $('#bufferSummaryTable').remove();

        if (Object.keys(sortedSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        table.append('<thead><tr><th>Buffer</th><th>Totale Container</th></tr></thead>');

        const tbody = $('<tbody></tbody>');
        let totalContainers = 0;

        Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
            // Aggiungi una riga per la Lane con testo a sinistra e totale container nella stessa riga
            let laneTotal = 0;

            // Calcolo del totale dei container
            Object.entries(laneSummary).forEach(([location, data]) => {
                laneTotal += data.count;
            });

            // Definizione del colore in base al totale dei container
            let laneColor = '';
            if (laneTotal <= 10) {
                laneColor = 'green';
            } else if (laneTotal <= 30) {
                laneColor = 'orange';
            } else {
                laneColor = 'red';
            }

            // Aggiungi la riga con il totale dei container per la lane
            tbody.append(`<tr><td colspan="2" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: <span style="color: ${laneColor};">${laneTotal}</span></td></tr>`);

            // Aggiungi le righe per i buffer specifici della lane
            Object.entries(laneSummary).forEach(([location, data]) => {
                const row = $('<tr></tr>');
                const count = data.count;

                // Colore per il numero di container
                let color = '';
                if (count <= 10) {
                    color = 'green';
                } else if (count <= 30) {
                    color = 'orange';
                } else {
                    color = 'red';
                }

                row.append(`<td>${location}</td>`);
                row.append(`<td style="color: ${color};">${count}</td>`);
                tbody.append(row);
            });

            totalContainers += laneTotal;
        });

        // Aggiungi una riga con il totale globale
        const globalTotalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale Globale</td><td>' + totalContainers + '</td></tr>');
        tbody.append(globalTotalRow);

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
                top: 70px;
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

    // Funzione per aggiungere i filtri
    function addFilters() {
        if (!isVisible) return;

        $('#filterContainer').remove();

        const filterContainer = $('<div id="filterContainer" style="margin-bottom: 20px; text-align: center; position: fixed; top: 10px; right: 10px; z-index: 9999;"></div>');

        // Crea il filtro per il buffer
        const bufferFilterInput = $('<input type="text" placeholder="Filtro per buffer" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        bufferFilterInput.val(selectedBufferFilter);

        bufferFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedBufferFilter = bufferFilterInput.val();
                fetchBufferSummary();
            }
        });

        filterContainer.append(bufferFilterInput);

        // Filtro per lane
        const laneFilterInput = $('<input type="text" placeholder="Filtro per lane" style="padding: 10px; font-size: 16px; width: 200px; margin-top: 10px;">');
        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = laneFilterInput.val().split(',').map(lane => lane.trim());
                fetchBufferSummary();
            }
        });

        filterContainer.append(laneFilterInput);

        // Aggiungi il pulsante per mostrare/nascondere
        const toggleButton = $('<button id="toggleButton" style="background-color: : #007bff; ; color: white; padding: 10px 15px; margin-top: 10px; left:950px;">Mostra Recuperi</button>');
        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                filterContainer.show();
                $('#bufferSummaryTable').show();
                toggleButton.text("Nascondi Recuperi");
            } else {
                filterContainer.hide();
                $('#bufferSummaryTable').hide();
                toggleButton.text("Mostra Recuperi");
            }
        });

        filterContainer.append(toggleButton);
        $('body').append(filterContainer);
    }

    // Esegui l'inizializzazione e il recupero dei dati
    fetchStackingFilterMap(function() {
        fetchBufferSummary();
    });

})();
