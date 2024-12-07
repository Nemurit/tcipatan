(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let isVisible = false;

    // Aggiungi la libreria Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(script);

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

    function processAndDisplay(containers) {
        const filteredSummary = {};
        let hasMatchingFilters = false;

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || null;

            const matchesBufferFilter = selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter);
            const matchesLaneFilter = selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()));
            const matchesCptFilter = selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter));

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                matchesBufferFilter &&
                matchesLaneFilter &&
                matchesCptFilter
            ) {
                if (!filteredSummary[location]) {
                    filteredSummary[location] = { count: 0, cpt: cpt };
                }

                filteredSummary[location].count++;
                hasMatchingFilters = true;
            }
        });

        if (!hasMatchingFilters) {
            console.warn("Nessun risultato trovato, mostrando tutti i dati non filtrati.");
            displayTable({});
            return;
        }

        displayTable(filteredSummary);
        generatePieChart(filteredSummary);
    }

    function generatePieChart(filteredSummary) {
        const labels = Object.keys(filteredSummary);
        const data = labels.map(location => filteredSummary[location].count);

        const ctx = document.getElementById('pieChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#FF9F40', '#4BC0C0', '#9966FF'],
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return tooltipItem.label + ': ' + tooltipItem.raw + ' container(s)';
                            }
                        }
                    }
                }
            }
        });
    }

    function displayTable(filteredSummary) {
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');
        
        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        const thead = $('<thead></thead>');
        thead.append(`
            <tr>
                <th>Buffer</th>
                <th>Totale Container</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        let totalContainers = 0;

        Object.entries(filteredSummary).forEach(([location, data]) => {
            const row = $('<tr></tr>');
            row.append(`<td>${location}</td>`);
            row.append(`<td>${data.count}</td>`);
            tbody.append(row);

            totalContainers += data.count;
        });

        const tfoot = $('<tfoot></tfoot>');
        const globalTotalRow = $('<tr><td colspan="2" style="text-align:right; font-weight: bold;">Totale Globale: ' + totalContainers + '</td></tr>');
        tfoot.append(globalTotalRow);

        table.append(thead);
        table.append(tbody);
        table.append(tfoot);
        contentContainer.append(table);

        $('body').append(contentContainer);

        const chartContainer = $('<div id="chartContainer" style="position: fixed; top: 10px; left: 10px; width: 400px; height: 400px;"></div>');
        const canvas = $('<canvas id="pieChart" width="400" height="400"></canvas>');
        chartContainer.append(canvas);
        $('body').append(chartContainer);
    }

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: calc(50% - 20px); padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Recuperi</button>');

        toggleButton.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                $(this).text("Nascondi Recuperi");
            } else {
                $('#contentContainer').remove();
                $('#chartContainer').remove();
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(toggleButton);
    }

    fetchStackingFilterMap(function() {
        addToggleButton();
        fetchBufferSummary();
    });

    // Aggiorna i dati ogni 3 minuti
    setInterval(fetchBufferSummary, 180000); // 180,000 ms = 3 minuti
})();
