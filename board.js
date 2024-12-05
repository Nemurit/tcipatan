(function () {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let stackingToLaneMap = {};
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let isTableVisible = true; // Default visibilità della tabella
    let isChartVisible = true; // Default visibilità del grafico
    let chart = null;

    console.log("Script inizializzato...");

    // Carica Chart.js
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = () => console.log("Chart.js caricato correttamente.");
    document.head.appendChild(script);

    function fetchStackingFilterMap(callback) {
        console.log("Caricamento mappa stacking...");
        GM_xmlhttpRequest({
            method: "GET",
            url: stackingFilterMapUrl,
            onload: function (response) {
                try {
                    const laneData = JSON.parse(response.responseText);
                    for (const [lane, stackingFilters] of Object.entries(laneData)) {
                        stackingFilters.forEach(filter => {
                            stackingToLaneMap[filter] = lane.split('[')[0];
                        });
                    }
                    console.log("Mappa stacking caricata con successo:", stackingToLaneMap);
                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing della mappa JSON:", error);
                }
            },
            onerror: function (error) {
                console.error("Errore nel caricamento del file JSON:", error);
            }
        });
    }

    function fetchBufferSummary() {
        console.log("Inizio recupero dati dei buffer...");
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
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        console.log("Dati recuperati:", containers);
                        processAndDisplay(containers);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API.");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API:", error);
                }
            },
            onerror: function (error) {
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
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
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

        const macroAreaSummary = createMacroAreaSummary(filteredSummary);
        displayFilters(); // Mostra i filtri per aggiornare la UI
        if (isTableVisible) {
            displayTable(filteredSummary);
        }
        if (isChartVisible) {
            displayChart(macroAreaSummary);
        }
    }

    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/);
        if (match) {
            const bufferNumber = match[1];
            return bufferNumber === filter;
        }
        return false;
    }

    function createMacroAreaSummary(summary) {
        const macroAreas = {
            "A Dispari": 0,
            "A Pari": 0,
            "B Dispari": 0,
            "B Pari": 0,
            "Colonne 13": 0,
            "Colonne 14": 0,
            "Colonne 15": 0
        };

        Object.values(summary).forEach(laneSummary => {
            Object.keys(laneSummary).forEach(location => {
                if (location.match(/\*3-\*3/)) {
                    macroAreas["A Dispari"] += laneSummary[location].count;
                } else if (location.match(/\*4-\*4/)) {
                    macroAreas["A Pari"] += laneSummary[location].count;
                } else if (location.match(/b4-b13/)) {
                    macroAreas["B Dispari"] += laneSummary[location].count;
                } else if (location.match(/e4-e13/)) {
                    macroAreas["B Pari"] += laneSummary[location].count;
                } else if (location.match(/\*13-\*13/)) {
                    macroAreas["Colonne 13"] += laneSummary[location].count;
                } else if (location.match(/\*14-\*14/)) {
                    macroAreas["Colonne 14"] += laneSummary[location].count;
                } else if (location.match(/\*15-\*15/)) {
                    macroAreas["Colonne 15"] += laneSummary[location].count;
                }
            });
        });

        return macroAreas;
    }

    function displayFilters() {
        console.log("Mostro i filtri...");
        $('#filtersContainer').remove();

        const filtersContainer = $('<div id="filtersContainer" style="position: fixed; top: 10px; left: 10px; background: white; padding: 10px; border: 1px solid #ddd; z-index: 1000;"></div>');

        const bufferInput = $('<input type="text" id="bufferFilter" placeholder="Filtra per buffer">');
        const applyButton = $('<button>Applica</button>');

        applyButton.on('click', () => {
            selectedBufferFilter = bufferInput.val();
            fetchBufferSummary();
        });

        filtersContainer.append(bufferInput);
        filtersContainer.append(applyButton);
        $('body').append(filtersContainer);
    }

    function displayTable(summary) {
        console.log("Mostro la tabella...");
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 100px; left: 10px; width: 400px; height: 90vh; overflow-y: auto; background: white; padding: 10px; border: 1px solid #ddd;"></div>');
        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        const thead = $('<thead><tr><th>Buffer</th><th>Totale</th></tr></thead>');
        const tbody = $('<tbody></tbody>');

        Object.entries(summary).forEach(([lane, laneSummary]) => {
            Object.entries(laneSummary).forEach(([location, data]) => {
                const row = $('<tr></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${data.count}</td>`);
                tbody.append(row);
            });
        });

        table.append(thead);
        table.append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);
    }

    function displayChart(summary) {
        console.log("Mostro il grafico...");
        $('#chartContainer').remove();

        const ctx = $('<canvas id="bufferChart" width="400" height="400"></canvas>');
        const chartContainer = $('<div id="chartContainer" style="position: fixed; top: 10px; right: 10px; width: 400px; height: 400px; background: white; padding: 10px; border: 1px solid #ddd;"></div>');
        chartContainer.append(ctx);
        $('body').append(chartContainer);

        const data = Object.values(summary);
        const labels = Object.keys(summary);

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx[0].getContext('2d'), {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Distribuzione dei Buffer per Macro Area'
                    }
                }
            }
        });
    }

    fetchStackingFilterMap(() => {
        fetchBufferSummary();
    });
})();
