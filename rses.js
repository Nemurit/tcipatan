(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let isVisible = false;
    let isChartVisible = false;
    let filteredSummary = {}; // Store filtered summary globally

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
        filteredSummary = {}; // Reset filteredSummary

        let hasMatchingFilters = false;

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || null;

            // Verifica se il container soddisfa i criteri di filtro
            const matchesBufferFilter = selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter);
            const matchesLaneFilter = selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()));
            const matchesCptFilter = selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter));

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                matchesBufferFilter &&
                matchesLaneFilter &&
                matchesCptFilter
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                }

                if (!filteredSummary[lane][location]) {
                    filteredSummary[lane][location] = { count: 0, cpt: cpt };
                }

                filteredSummary[lane][location].count++;
                hasMatchingFilters = true;
            }
        });

        const sortedSummary = {};
        Object.keys(filteredSummary).forEach(lane => {
            const laneSummary = filteredSummary[lane];
            sortedSummary[lane] = Object.keys(laneSummary)
                .sort((a, b) => {
                    const numA = parseBufferNumber(a);
                    const numB = parseBufferNumber(b);

                    if (numA === numB) {
                        return a.localeCompare(b);
                    }
                    return numA - numB;
                })
                .reduce((acc, location) => {
                    acc[location] = laneSummary[location];
                    return acc;
                }, {});
        });

        if (!hasMatchingFilters) {
            console.warn("Nessun risultato trovato, mostrando tutti i dati non filtrati.");
            displayTable({});
            return;
        }

        if (isVisible) {
            displayTable(sortedSummary);
        }

        if (isChartVisible) {
            generatePieChart(filteredSummary);
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

    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function convertTimestampToLocalTime(timestamp) {
        const date = new Date(timestamp);
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        };
        return date.toLocaleString('it-IT', options);
    }

    function filterCpt(cpt, filter) {
        try {
            const date = new Date(cpt);
            const cptLocalTime = date.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const filterParts = filter.split(',').map(f => f.trim());

            return filterParts.some(part => {
                if (/^\d{1,2}$/.test(part)) {
                    const hour = part.padStart(2, '0');
                    return cptLocalTime.startsWith(hour + ':');
                }
                return part === cptLocalTime;
            });
        } catch (error) {
            console.warn("Errore nel filtro CPT o valore non valido:", error);
            return false;
        }
    }

    function displayTable(sortedSummary) {
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; height: 90vh; width: 400px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); background: white; padding: 10px; border: 1px solid #ddd;"></div>');

        if (Object.keys(sortedSummary).length === 0) {
            return;
        }

        const table = $('<table id="bufferSummaryTable" class="performance"></table>');
        const thead = $('<thead></thead>');
        thead.append(`
            <tr>
                <th>
                    <input id="bufferFilterInput" type="text" placeholder="Filtro per BUFFER" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
                <th>
                    <input id="laneFilterInput" type="text" placeholder="Filtro per LANE (es. Lane1, Lane2)" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
                <th>
                    <input id="cptFilterInput" type="text" placeholder="Filtro per CPT (es. 14)" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
            </tr>
        `);

        thead.append(`
            <tr>
                <th>Buffer</th>
                <th>Totale Container</th>
                <th>CPT</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        let totalContainers = 0;

        Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
            let laneTotal = 0;

            Object.entries(laneSummary).forEach(([location, data]) => {
                laneTotal += data.count;
            });

            let laneColor = '';
            if (laneTotal <= 10) {
                laneColor = 'green';
            } else if (laneTotal <= 30) {
                laneColor = 'orange';
            } else {
                laneColor = 'red';
            }

            const laneRow = $(`<tr class="laneRow" style="cursor: pointer;">
                <td colspan="3" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: <span style="color: ${laneColor};">${laneTotal}</span></td>
            </tr>`);

            laneRow.on('click', function() {
                const nextRows = $(this).nextUntil('.laneRow');
                nextRows.toggle();
            });

            tbody.append(laneRow);

            Object.entries(laneSummary).forEach(([location, data]) => {
                const row = $('<tr class="containerRow" style="display: none;"></tr>');

                row.append(`
                    <td>${location}</td>
                    <td>${data.count}</td>
                    <td>${data.cpt ? convertTimestampToLocalTime(data.cpt) : ''}</td>
                `);

                tbody.append(row);
            });
        });

        table.append(thead).append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);
    }

    function generatePieChart(filteredSummary) {
        if (!filteredSummary || Object.keys(filteredSummary).length === 0) return;

        const labels = Object.keys(filteredSummary);
        const data = labels.map(location => {
            return Object.values(filteredSummary[location]).reduce((acc, locData) => acc + locData.count, 0);
        });

        const chartData = {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00', '#0000ff', '#8a2be2'],
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        };

        const ctx = document.getElementById('myChart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: chartData
        });
    }

    function addChartToggleButton() {
        const button = $('<button id="toggleChartButton">Mostra Grafico</button>');
        button.css({
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            padding: '10px',
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '5px',
            fontSize: '14px'
        });

        button.on('click', function() {
            isChartVisible = !isChartVisible;
            if (isChartVisible) {
                generatePieChart(filteredSummary);
                $(this).text('Nascondi Grafico');
            } else {
                $('#myChart').remove();
                $(this).text('Mostra Grafico');
            }
        });

        $('body').append(button);
    }

    function addTableToggleButton() {
        const button = $('<button id="toggleButton">Mostra Recuperi</button>');
        button.css({
            position: 'fixed',
            top: '10px',
            right: '10px',
            padding: '10px',
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '5px',
            fontSize: '14px'
        });

        button.on('click', function() {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                $(this).text("Nascondi Recuperi");
            } else {
                $('#contentContainer').remove();
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(button);
    }

    $(document).ready(function() {
        addTableToggleButton();
        addChartToggleButton();
        fetchStackingFilterMap();
    });
})();
