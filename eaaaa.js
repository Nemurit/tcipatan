(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let sortedSummary = {}; // Variabile globale per i dati filtrati e ordinati
    let isVisible = false;

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
        console.log("Dati containers ricevuti:", containers); // Log per diagnosticare i dati
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || null;

            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
                (selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter)))
            ) {
                if (!filteredSummary[location]) {
                    filteredSummary[location] = { count: 0 };
                }

                filteredSummary[location].count++;
            }
        });

        sortedSummary = filteredSummary; // Usando direttamente la variabile globale per i buffer sommati

        if (isVisible) {
            displayTable(sortedSummary);
        }
    }

    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/); // Trova la lettera seguita dal numero
        if (match) {
            const bufferNumber = match[1];  // Estrae il numero
            return bufferNumber === filter;
        }
        return false;
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
                    <input id="cptFilterInput" type="text" placeholder="Filtro per CPT (es. 16)" style="width: 100%; padding: 5px; box-sizing: border-box;">
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

        Object.entries(sortedSummary).forEach(([location, data]) => {
            const bufferRow = $(`<tr>
                <td>${location}</td>
                <td>${data.count}</td>
                <td></td>
            </tr>`);
            tbody.append(bufferRow);

            totalContainers += data.count;
        });

        table.append(thead);
        table.append(tbody);
        contentContainer.append(table);
        $('body').append(contentContainer);

        isVisible = true;

        // Event listener per il filtro del buffer
        $('#bufferFilterInput').on('input', function() {
            selectedBufferFilter = $(this).val();
            fetchBufferSummary();
        });

        // Event listener per il filtro della lane
        $('#laneFilterInput').on('input', function() {
            selectedLaneFilters = $(this).val().split(',').map(filter => filter.trim());
            fetchBufferSummary();
        });

        // Event listener per il filtro del CPT
        $('#cptFilterInput').on('input', function() {
            selectedCptFilter = $(this).val();
            fetchBufferSummary();
        });
    }

    function createBufferChart() {
        console.log("Dati di sortedSummary per il grafico:", sortedSummary);

        if (!sortedSummary || Object.keys(sortedSummary).length === 0) {
            alert("Nessun dato disponibile per generare il grafico.");
            return;
        }

        const chartData = [];
        Object.entries(sortedSummary).forEach(([buffer, data]) => {
            chartData.push({ label: buffer, value: data.count });
        });

        if (chartData.length === 0) {
            alert("Nessun dato disponibile per generare il grafico.");
            return;
        }

        const chartContainer = $('<canvas id="bufferChartCanvas"></canvas>');
        $('body').append(chartContainer);

        const ctx = document.getElementById('bufferChartCanvas').getContext('2d');

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.map(d => d.label),
                datasets: [{
                    data: chartData.map(d => d.value),
                    backgroundColor: chartData.map(() => `#${Math.floor(Math.random() * 16777215).toString(16)}`)
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    // Avvia il caricamento della mappa di filtro e la chiamata per i dati
    fetchStackingFilterMap(fetchBufferSummary);

})();
