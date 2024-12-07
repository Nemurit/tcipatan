(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
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
        const filteredSummary = {};
        let hasMatchingFilters = false; // Variabile per verificare se almeno un dato corrisponde ai filtri
    
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
                hasMatchingFilters = true; // Almeno un dato corrisponde ai filtri
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
    
        // Se nessun filtro ha prodotto risultati, lascia la tabella visibile come se non fosse applicato alcun filtro
        if (!hasMatchingFilters) {
            console.warn("Nessun risultato trovato, mostrando tutti i dati non filtrati.");
            displayTable({});
            return;
        }
    
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
                if (isValidCptFilter(newFilter)) {
                    selectedCptFilter = newFilter;
                    fetchBufferSummary();
                } else {
                    alert("Il filtro inserito non è valido. Usare valori come '16, 16:15, 16:30'.");
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

  function addChartButton() {
    const chartButton = $('<button id="chartButton" style="position: fixed; top: 50px; left: calc(50% - 40px); padding: 4px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Grafico</button>');

    chartButton.on('click', function () {
        createBufferChart();
    });

    $('body').append(chartButton);
}

function createBufferChart() {
    if (!sortedSummary || Object.keys(sortedSummary).length === 0) {
        alert("Nessun dato disponibile per generare il grafico.");
        return;
    }

    // Raccogli i dati per il grafico
    const chartLabels = [];
    const chartData = [];
    Object.entries(sortedSummary).forEach(([lane, laneSummary]) => {
        Object.entries(laneSummary).forEach(([buffer, data]) => {
            chartLabels.push(buffer);
            chartData.push(data.count);
        });
    });

    if (chartData.length === 0) {
        alert("Nessun dato disponibile per generare il grafico.");
        return;
    }

    // Creazione della finestra per il grafico
    const chartContainerId = 'chartContainer';
    if (!$(`#${chartContainerId}`).length) {
        const chartContainer = $(`
            <div id="${chartContainerId}" style="position: fixed; top: 100px; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; background: white; padding: 10px; border: 1px solid #ddd; z-index: 9999; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <canvas id="bufferChart" style="width: 100%; height: 100%;"></canvas>
                <button id="closeChartButton" style="position: absolute; top: 5px; right: 5px; background-color: red; color: white; border: none; border-radius: 3px; padding: 5px;">X</button>
            </div>
        `);
        $('body').append(chartContainer);

        $('#closeChartButton').on('click', function () {
            $(`#${chartContainerId}`).remove();
        });
    }

    // Configurazione del grafico a torta con Chart.js
    const ctx = document.getElementById('bufferChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Numero di Container per Buffer',
                data: chartData,
                backgroundColor: chartData.map((_, index) => `hsl(${index * 30}, 70%, 50%)`),
                borderWidth: 1,
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
                        label: function (tooltipItem) {
                            return `${tooltipItem.label}: ${tooltipItem.raw} container`;
                        }
                    }
                }
            }
        }
    });
}

// Aggiunta del pulsante per il grafico
fetchStackingFilterMap(function () {
    addToggleButton();
    addChartButton(); // Aggiungiamo il pulsante per il grafico
    fetchBufferSummary();
});

    
    // Aggiorna i dati ogni 3 minuti
    setInterval(fetchBufferSummary, 180000); // 180,000 ms = 3 minuti
})();
