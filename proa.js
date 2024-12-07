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
    const filteredSummary = {};

    containers.forEach(container => {
        const location = container.location || '';
        const stackingFilter = container.stackingFilter || 'N/A';
        const lane = stackingToLaneMap[stackingFilter] || 'N/A';
        const cpt = container.cpt || null;

        // Filter only the buffers that contain "BUFFER"
        if (
            location.toUpperCase().startsWith("BUFFER") &&
            (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
            (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
            (selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter)))
        ) {
            if (!filteredSummary[lane]) {
                filteredSummary[lane] = {};
            }

            if (!filteredSummary[lane][location]) {
                filteredSummary[lane][location] = { count: 0, cpt: cpt };
            }

            filteredSummary[lane][location].count++;
        }
    });

    console.log("Filtered Summary:", filteredSummary); // Debugging line

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

    if (isVisible) {
        displayTable(sortedSummary);
    }

    // If sortedSummary is not empty, pass it to the chart generation function
    if (Object.keys(sortedSummary).length > 0) {
        generatePieChart(sortedSummary);
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

    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function convertTimestampToLocalTime(timestamp) {
        const date = new Date(timestamp);
        // Ottieni l'ora locale
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
            // Converte CPT al fuso orario locale e formato "HH:MM"
            const date = new Date(cpt);
            const cptLocalTime = date.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
    
            // Dividiamo il filtro in parti (es. "16", "16:15", ecc.)
            const filterParts = filter.split(',').map(f => f.trim());
    
            // Confrontiamo ogni parte del filtro con l'orario locale "HH:MM"
            return filterParts.some(part => {
                if (/^\d{1,2}$/.test(part)) {
                    // Se il filtro è solo "HH", confronta solo l'ora
                    const hour = part.padStart(2, '0');
                    return cptLocalTime.startsWith(hour + ':'); // HH corrisponde
                }
                // Se il filtro è "HH:MM", confronta l'intero valore
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
                // Visualizza il CPT solo nelle righe delle lane
                const row = $('<tr class="locationRow"></tr>');
                row.append(`<td>${location}</td>`);
                row.append(`<td>${data.count}</td>`);
                row.append(`<td>${data.cpt ? convertTimestampToLocalTime(data.cpt) : 'N/A'}</td>`);
                tbody.append(row);
            });

            totalContainers += laneTotal;
        });

        const tfoot = $('<tfoot></tfoot>');
        const globalTotalRow = $('<tr><td colspan="3" style="text-align:right; font-weight: bold;">Totale Globale: ' + totalContainers + '</td></tr>');
        tfoot.append(globalTotalRow);

        table.append(thead);
        table.append(tbody);
        table.append(tfoot);
        contentContainer.append(table);

        $('body').append(contentContainer);

        $('#bufferFilterInput').val(selectedBufferFilter).on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedBufferFilter = $(this).val();
                fetchBufferSummary();
            }
        });

        $('#laneFilterInput').val(selectedLaneFilters.join(', ')).on('keydown', function(event) {
            if (event.key === "Enter") {
                selectedLaneFilters = $(this).val().split(',').map(filter => filter.trim());
                fetchBufferSummary();
            }
        });

        $('#cptFilterInput').val(selectedCptFilter).on('keydown', function(event) {
    if (event.key === "Enter") {
        const newFilter = $(this).val();
        if (newFilter === "") {
            // Se il filtro CPT è vuoto, resettiamo il filtro
            selectedCptFilter = '';
            fetchBufferSummary();
        } else {
            if (isValidCptFilter(newFilter)) {
                selectedCptFilter = newFilter;
                fetchBufferSummary();
            } else {
                alert("Il filtro inserito non è valido. Usare valori come '16, 16:15, 16:30'.");
            }
        }
    }
});
        
        function isValidCptFilter(filter) {
            const parts = filter.split(',').map(f => f.trim());
            return parts.every(part => /^(\d{1,2}(:\d{2})?)$/.test(part)); // Es. 16 o 16:15
        }
        
        GM_addStyle(`
            #bufferSummaryTable {
                table-layout: auto;
                margin: 20px 0;
                border-collapse: collapse;
                width: 100%;
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
            #bufferSummaryTable tfoot {
                background-color: #f4f4f4;
            }
            #bufferSummaryTable input {
                font-size: 14px;
                padding: 5px;
                margin: 0;
            }
            .locationRow {
                display: none;
            }
        `);
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
                $(this).text('Chiudi Grafico'); // Cambia testo del pulsante quando il grafico è visibile
            } else {
                $('#chartContainer').remove(); // Rimuovi il grafico quando viene chiuso
                $(this).text('Mostra Grafico'); // Ripristina il testo del pulsante
            }
        });
    
        $('body').append(button);
    }
    
    function generatePieChart(filteredSummary) {
        if (!filteredSummary || Object.keys(filteredSummary).length === 0) {
            console.warn("No data to generate the chart.");
            return;
        }
    
        // Create the chart container dynamically if it doesn't exist
        let chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'chartContainer';
            chartContainer.style.display = 'none'; // Initially hidden
            chartContainer.style.position = 'fixed';
            chartContainer.style.top = '10px';
            chartContainer.style.left = '50%';
            chartContainer.style.transform = 'translateX(-50%)';
            chartContainer.style.padding = '20px';
            chartContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';  // Background transparent
            chartContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            chartContainer.style.borderRadius = '10px';
            chartContainer.style.width = '500px';
            chartContainer.style.maxWidth = '100%';
            chartContainer.style.zIndex = '1000';
            chartContainer.style.boxSizing = 'border-box'; // Ensure padding is included in the width/height calculation
    
            // Add a canvas to the container
            const chartCanvas = document.createElement('canvas');
            chartCanvas.id = 'myChart';
            chartCanvas.style.width = '100%';  // Full width inside container
            chartCanvas.style.height = '400px'; // Fixed height for chart
            chartContainer.appendChild(chartCanvas);
    
            document.body.appendChild(chartContainer);
        }
    
        // Aggregate data by buffer location
        const bufferLocations = {};  // To store the total count of containers per buffer location
    
        Object.entries(filteredSummary).forEach(([lane, laneSummary]) => {
            Object.entries(laneSummary).forEach(([location, data]) => {
                if (location.startsWith("BUFFER")) {
                    if (!bufferLocations[location]) {
                        bufferLocations[location] = 0;
                    }
                    bufferLocations[location] += data.count;  // Add up the count of containers for the buffer location
                }
            });
        });
    
        // Prepare data for the chart
        const labels = Object.keys(bufferLocations);
        const data = labels.map(location => bufferLocations[location]);
    
        if (data.length === 0) {
            console.warn("No buffer locations to chart.");
            return;
        }
    
        const chartData = {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00', '#0000ff', '#8a2be2'],
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        };
    
        // Get the canvas context and create the chart
        const ctx = document.getElementById('myChart').getContext('2d');
        if (ctx) {
            new Chart(ctx, {
                type: 'pie',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(tooltipItem) {
                                    const label = tooltipItem.label || '';
                                    const value = tooltipItem.raw || 0;
                                    return `${label}: ${value}`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            console.error("Canvas context could not be found.");
        }
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
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer.style.display === 'none') {
                chartContainer.style.display = 'block';  // Show the chart container
                generatePieChart(filteredSummary);  // Generate chart if it's not already done
                $(this).text('Nascondi Grafico');
            } else {
                chartContainer.style.display = 'none';  // Hide the chart container
                $(this).text('Mostra Grafico');
            }
        });
    
        $('body').append(button);
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
                $(this).text("Mostra Recuperi");
            }
        });

        $('body').append(toggleButton);
    }

    fetchStackingFilterMap(function() {
        addToggleButton();
        addChartToggleButton();
        fetchBufferSummary();
    });

    // Aggiorna i dati ogni 3 minuti
    setInterval(fetchBufferSummary, 180000); // 180,000 ms = 3 minuti
})();
