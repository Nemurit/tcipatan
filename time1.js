(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let isVisible = false;
    let selectedTimeFilter = ''; // Nuovo filtro per orario

    // Funzione di formattazione del timestamp CPT
    function formatCPTTimestamp(timestamp) {
        const date = new Date(timestamp);
        // Converti l'orario in UTC +1
        const hours = (date.getUTCHours() + 1).toString().padStart(2, '0'); // Ora in formato 2 cifre (UTC +1)
        const minutes = date.getUTCMinutes().toString().padStart(2, '0'); // Minuti in formato 2 cifre
        const day = date.getUTCDate().toString().padStart(2, '0'); // Giorno del mese
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Mese (0-based, quindi +1)
        const year = date.getUTCFullYear();

        return `${hours}:${minutes} ${day}-${month}-${year}`;
    }

    // Carica la mappa dei filtri di stacking
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

    // Recupera i dettagli dei container
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

    // Elabora e mostra i dati dei container
    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';

            // Filtra solo i buffer che contengono "BUFFER" e gestisce correttamente il filtro numerico
            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = { totalContainers: 0, cpts: [] };
                }

                // Aggiungi il CPT
                if (container.cpt) {
                    const formattedCPT = formatCPTTimestamp(container.cpt); // Converte il timestamp
                    // Aggiungi solo il primo orario per lane, evitando duplicati
                    if (!filteredSummary[lane].cpts.includes(formattedCPT)) {
                        filteredSummary[lane].cpts.push(formattedCPT);
                    }
                }

                // Conta il numero di containers per lane
                filteredSummary[lane].totalContainers++;
            }
        });

        // Filtro per orario (se presente)
        if (selectedTimeFilter) {
            for (const lane in filteredSummary) {
                filteredSummary[lane].cpts = filteredSummary[lane].cpts.filter(cpt => cpt.startsWith(selectedTimeFilter));
            }
        }

        if (isVisible) {
            displayTable(filteredSummary);
        }
    }

    // Filtro per numero esatto di buffer
    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/);
        if (match) {
            const bufferNumber = match[1];
            return bufferNumber === filter;
        }
        return false;
    }

    // Mostra i dati in una tabella
    function displayTable(filteredSummary) {
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');

        if (Object.keys(filteredSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');

        const thead = $('<thead></thead>');
        thead.append(`
            <tr>
                <th>Lane</th>
                <th>Totale Container</th>
                <th>Orari (CPT)</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        Object.entries(filteredSummary).forEach(([lane, laneData]) => {
            const row = $('<tr></tr>');
            const totalContainers = laneData.totalContainers;
            const cpts = laneData.cpts.join(', '); // Orari in formato leggibile (unico per lane)

            row.append(`<td>${lane}</td>`);
            row.append(`<td>${totalContainers}</td>`);
            row.append(`<td>${cpts}</td>`);

            tbody.append(row);
        });

        table.append(thead);
        table.append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);
    }

    // Filtro per orario (input dell'utente)
    function addTimeFilter() {
        const timeFilterInput = $('<input id="timeFilterInput" type="text" placeholder="Filtro per Orario (es. 08:30)" style="position: fixed; top: 50px; right: 10px; padding: 5px; box-sizing: border-box;">');

        timeFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedTimeFilter = $(this).val();
                fetchBufferSummary();
            }
        });

        $('body').append(timeFilterInput);
    }

    // Aggiungi il bottone per toggle dei recuperi
    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: calc(50% - 20px); padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Recuperi</button>');

        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                $(this).text("Nascondi Recuperi");
            } else {
                $('#contentContainer').remove();
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(toggleButton);
    }

    // Aggiungi i filtri per lane
    function addFilters() {
        const laneFilterInput = $('<input id="laneFilterInput" type="text" placeholder="Filtro per Lane" style="position: fixed; top: 90px; right: 10px; padding: 5px; box-sizing: border-box;">');
        
        laneFilterInput.on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = $(this).val().split(',');
                fetchBufferSummary();
            }
        });

        $('body').append(laneFilterInput);
    }

    // Funzione di avvio
    function init() {
        fetchStackingFilterMap(function() {
            addFilters();
            addTimeFilter();
            addToggleButton();
        });
    }

    init();
})();
