// RECUPERI 

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

        const apiUrl = `https://trans-logistics-eu.amazon.com/sortcenter/vista/controller/getContainersDetailByCriteria`;
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

    function matchesBufferByString(location, filter) {
        const regex = new RegExp(`^BUFFER\\s.*${filter}$|^BUFFER\\s${filter}.*$`, 'i'); // Case insensitive
        return regex.test(location);
    }

    function matchesBufferByNumber(location, number) {
        const regex = new RegExp(`\\b${number}\\b`); // Numero isolato
        return regex.test(location);
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
                (selectedBufferFilter === '' || matchesBufferByString(location, selectedBufferFilter)) &&
                (selectedNumberFilter === '' || matchesBufferByNumber(location, selectedNumberFilter)) &&
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

function matchesExactBufferString(location, filter) {
    // Converto entrambi in maiuscolo per evitare problemi di case
    const locationUpper = location.toUpperCase();
    const filterUpper = filter.toUpperCase();

    // Caso 1: Se il filtro è la stringa completa (es. "BUFFER E4 - F4")
    if (locationUpper.includes(filterUpper)) {
        return true;
    }

    // Caso 2: Se il filtro è separato in lettera e numero (es. "E4" o "4")
    const filterParts = filterUpper.split(' ').filter(Boolean);
    const locationParts = locationUpper.split(' ').filter(Boolean);

    // Se il filtro ha due parti (lettera e numero)
    if (filterParts.length === 2 && locationParts.length === 2) {
        const [filterLetter, filterNumber] = filterParts;
        const [locationLetter, locationNumber] = locationParts;

        // Confronta lettera e numero separatamente
        return locationLetter === filterLetter && locationNumber === filterNumber;
    }

    // Se il filtro ha una sola parte (lettera o numero)
    if (filterParts.length === 1 && locationParts.length === 2) {
        const [filterLetterOrNumber] = filterParts;
        const [locationLetter, locationNumber] = locationParts;

        // Se è solo la lettera che corrisponde
        if (isNaN(filterLetterOrNumber)) {
            return locationLetter === filterLetterOrNumber;
        }
        
        // Se è solo il numero che corrisponde
        return locationNumber === filterLetterOrNumber;
    }

    // Default: se non corrisponde
    return false;
}


// All'interno della funzione processAndDisplay
function processAndDisplay(containers) {
    const filteredSummary = {};

    containers.forEach(container => {
        const location = container.location || '';
        const stackingFilter = container.stackingFilter || 'N/A';
        const lane = stackingToLaneMap[stackingFilter] || 'N/A';
        const cpt = container.cpt || null;

        // Filtro solo i buffer che contengono "BUFFER" e applico il filtro selezionato
        if (
            location.toUpperCase().startsWith("BUFFER") &&
            (selectedBufferFilter === '' || matchesExactBufferString(location, selectedBufferFilter)) &&  // Usa matchesExactBufferString
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

    // Se sortedSummary non è vuoto, generiamo il grafico
    if (Object.keys(sortedSummary).length > 0) {
        generatePieChart(sortedSummary);
    }
}



function parseBufferNumber(bufferName) {
    const match = bufferName.match(/BUFFER\s*([A-Za-z]*)\s*(\d+)/);  // Trova eventuali lettere seguite dal numero
    if (match) {
        return parseInt(match[2], 10);  // Estrai e restituisci solo la parte numerica
    }
    return null;  // Restituisci null se non trova un numero
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
            chartContainer.style.top = '60px';
            chartContainer.style.left = '50%';
            chartContainer.style.padding = '20px';
            chartContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';  // Background transparent
            chartContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
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
            const chart = new Chart(ctx, {
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
                    },
                    onClick: function(event, elements) {
                        if (elements.length > 0) {
                            // Get the label of the clicked slice (buffer location)
                            const clickedLabel = chart.data.labels[elements[0].index];
                            // Set the buffer filter to the clicked label
                            selectedBufferFilter = clickedLabel;
                            $('#bufferFilterInput').val(selectedBufferFilter);  // Update the input field
                            fetchBufferSummary();  // Fetch the updated data based on the new filter
                        }
                    }
                }
            });
        } else {
            console.error("Canvas context could not be found.");
        }
    }
    
    
    function addChartToggleButton() {
        const button = $('<button id="toggleChartButton"  style="position: fixed; top: 35px; left: calc(50% - 22px); padding: 10px; background: rgb(0, 123, 255); color: white; border: none; cursor: pointer; border-radius: 5px; font-size: 14px;">Mostra grafico recuperi</button>');
        
    
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


// TRUCK FUTURI
(function () {
    'use strict';
    
document.title = "Clerk Handover"
    
    const url = "https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob/fetchdata?";
    const entityName = "getDefaultOutboundDockView";
    const payload = `entity=${entityName}&nodeId=MXP6&startDate=1733700600000&endDate=1733873400000&loadCategories=outboundScheduled,outboundInProgress,outboundReadyToDepart,outboundDeparted,outboundCancelled`;

    let allRows = [];
    let tableContainer = null;
    let dropdown = null;
    let timeInputBox = null;
    let vrIdInputBox = null;
    let laneInputBox = null;
    let printButton = null;
    let rowCountDisplay = null;
    let filtersContainer = null;
    let isDataFetched = false;  // Flag per sapere se i dati sono stati recuperati
    let isTableVisible = false; // Flag per sapere se la tabella è visibile

    // Funzione per recuperare i dati
    function fetchData(hours) {
        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://trans-logistics-eu.amazon.com/ssp/dock/hrz/ob",
                
            },
            data: payload,
            onload: function (response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.ret && Array.isArray(data.ret.aaData)) {
                            processFetchedData(data.ret.aaData, hours);
                        } else {
                            console.error("La risposta dell'API non contiene 'ret' o 'aaData'.");
                        }
                    } catch (error) {
                        console.error("Errore nel parsing dei dati:", error);
                    }
                } else {
                    console.error("Errore nella richiesta:", response.status, response.statusText);
                }
            },
            onerror: function (error) {
                console.error("Richiesta fallita:", error);
            },
        });
    }

    function processFetchedData(apiData, hours) {
    const now = new Date();
    const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

    allRows = apiData.map(item => {
        const load = item.load || {};
        let truckType = "COLLECTION"; // Default è "COLLECTION"
        
        // Controllo se la lane inizia con "MXP6" e se è seguita esattamente da 4 caratteri
        if (load.route && load.route.startsWith("MXP6") && load.route.length === 8) {
            truckType = "TRANSFER"; // Se la condizione è soddisfatta, cambia il tipo a "TRANSFER"
        }
        // Se la condizione del "TRANSFER" non è soddisfatta, verifica se è "CPT"
        else if (load.scheduledDepartureTime === load.criticalPullTime) {
            truckType = "CPT";
        }

        return {
            lane: load.route || "N/A",
            sdt: load.scheduledDepartureTime || "N/A",
            cpt: load.criticalPullTime || "N/A",
            vrId: load.vrId || "N/A",
            date: new Date(load.scheduledDepartureTime),
            extraText: truckType,
            highlightColor: truckType === "TRANSFER" ? "violet" : truckType === "CPT" ? "green" : "orange",
        };
    });

    // Ordina i dati per SDT (Scheduled Departure Time)
    allRows.sort((a, b) => a.date - b.date);

    filterAndShowData(hours);
}


    function filterAndShowData(hours) {
        const now = new Date();
        const maxDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

        // Ottieni i filtri
        const status = dropdown ? dropdown.value : 'Tutti';
        const vrIdFilter = vrIdInputBox.value.trim().toLowerCase();
        const laneFilter = laneInputBox ? laneInputBox.value.trim().toLowerCase() : '';

        // Filtra prima tutti i dati, indipendentemente dalla finestra temporale
        let filteredRows = allRows;

        if (vrIdFilter) {
            filteredRows = filteredRows.filter(row => row.vrId.toLowerCase().includes(vrIdFilter));
        }

        if (status !== 'Tutti') {
            filteredRows = filteredRows.filter(row => row.extraText === status);
        }

        if (laneFilter) {
            filteredRows = filteredRows.filter(row => row.lane.toLowerCase().includes(laneFilter));
        }

        // Ora applica la finestra temporale, solo se non ci sono filtri VR ID o Lane
        if (!vrIdFilter && !laneFilter) {
            filteredRows = filteredRows.filter(row => row.date >= now && row.date <= maxDate);
        }

        // Mostra i dati filtrati nella tabella
        showDataInTable(filteredRows);
        updateRowCount(filteredRows.length);
    }

    function showDataInTable(filteredRows) {
        if (tableContainer) {
            tableContainer.remove();
        }

        tableContainer = document.createElement('div');
        tableContainer.style.position = 'fixed';
        tableContainer.style.top = '90px';
        tableContainer.style.left = '10px';
        tableContainer.style.zIndex = '10001';
        tableContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        tableContainer.style.padding = '15px';
        tableContainer.style.maxHeight = '400px';
        tableContainer.style.overflowY = 'scroll';
        tableContainer.style.width = '25%';
        tableContainer.style.border = '1px solid #ccc';
        tableContainer.style.borderRadius = '5px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.fontSize = '14px';
        table.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        table.innerHTML = `
            <thead style="background-color: #f4f4f4; border-bottom: 2px solid #ccc;">
                <tr>
                    <th style="padding: 10px; text-align: left;">LANE</th>
                    <th style="padding: 10px; text-align: left;">SDT</th>
                    <th style="padding: 10px; text-align: left;">CPT</th>
                    <th style="padding: 10px; text-align: left;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRows.map(row => `
                    <tr style="background-color: ${row.highlightColor}; color: white; text-align: left;">
                        <td style="padding: 10px;">${row.lane}</td>
                        <td style="padding: 10px;">${row.sdt}</td>
                        <td style="padding: 10px;">${row.cpt}</td>
                        <td style="padding: 10px;">${row.extraText}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        tableContainer.appendChild(table);
        document.body.appendChild(tableContainer);
    }

    function updateRowCount(count) {
        if (!rowCountDisplay) return;
        rowCountDisplay.innerHTML = `NUMERO TRUCKS: ${count}`;
    }

    function createButtons() {
        const containermain = document.createElement('div');
        containermain.style.position = 'fixed';
        containermain.style.top = '10px';
        containermain.style.left = '10px';
        containermain.style.zIndex = '10001';
        containermain.style.padding = '10px';
        containermain.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        containermain.style.borderRadius = '5px';
        containermain.style.display = 'flex';
        containermain.style.flexDirection = 'row';

        const button = document.createElement('button');
        button.innerHTML = 'Visualizza TRUCKS';
        button.style.padding = '3px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', function () {
            const hours = timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1;

            if (isTableVisible) {
                // Nascondi la tabella e i filtri
                tableContainer.style.display = 'none';
                filtersContainer.style.display = 'none';
                button.innerHTML = 'Visualizza TRUCKS';
                isTableVisible = false;
            } else {
                // Mostra i filtri
                filtersContainer.style.display = 'block';

                if (!isDataFetched) {
                    fetchData(hours); // Fetch i dati la prima volta
                    isDataFetched = true; // Impostiamo il flag su true
                }

                // Cambia il testo del pulsante in "Nascondi TRUCKS"
                button.innerHTML = 'Nascondi TRUCKS';

                // Mostra la tabella
                tableContainer.style.display = 'block';
                filtersContainer.style.display = 'block';
                isTableVisible = true;
            }
        });

        // Aggiungi i filtri
        filtersContainer = document.createElement('div');
        filtersContainer.style.display = 'none';  // I filtri sono inizialmente nascosti
        filtersContainer.style.marginTop = '10px';

        dropdown = document.createElement('select');
        dropdown.style.marginRight = '5px';
        dropdown.style.padding = '3px';
        ['Tutti', 'CPT', 'COLLECTION', 'TRANSFER'].forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.innerHTML = option;
            dropdown.appendChild(opt);
        });
        dropdown.addEventListener('change', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        timeInputBox = document.createElement('input');
        timeInputBox.type = 'number';
        timeInputBox.placeholder = 'Ore';
        timeInputBox.style.padding = '3px';
        timeInputBox.style.marginRight = '5px';
        timeInputBox.addEventListener('input', function () {
            filterAndShowData(parseInt(timeInputBox.value, 10));
        });

        vrIdInputBox = document.createElement('input');
        vrIdInputBox.type = 'text';
        vrIdInputBox.placeholder = 'Filtro VR ID';
        vrIdInputBox.style.padding = '3px';
        vrIdInputBox.style.marginRight = '5px';
        vrIdInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        laneInputBox = document.createElement('input');
        laneInputBox.type = 'text';
        laneInputBox.placeholder = 'Filtro Lane';
        laneInputBox.style.padding = '3px';
        laneInputBox.style.marginRight = '5px';
        laneInputBox.addEventListener('input', function () {
            filterAndShowData(timeInputBox.value ? parseInt(timeInputBox.value, 10) : 1);
        });

        printButton = document.createElement('button');
        printButton.innerHTML = 'Stampa';
        printButton.style.padding = '3px';
        printButton.style.marginRight = '5px';
        printButton.addEventListener('click', function () {
            if (tableContainer) {
                const printWindow = window.open('', '_blank');
                const printDocument = printWindow.document;
                printDocument.open();
                printDocument.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Stampa Tabella</title>
                        <style>
                            table {
                                width: 100%;
                                border-collapse = collapse;
                                margin-bottom: 20px;
                                font-family: Arial, sans-serif;
                            }
                        </style>
                    </head>
                    <body>
                        ${tableContainer.innerHTML}
                    </body>
                    </html>
                `);
                printDocument.close();
                printWindow.print();
            } else {
                alert('Nessuna tabella disponibile per la stampa.');
            }
        });

        rowCountDisplay = document.createElement('span');
        rowCountDisplay.style.marginLeft = '5px';

        filtersContainer.appendChild(dropdown);
        filtersContainer.appendChild(timeInputBox);
        filtersContainer.appendChild(vrIdInputBox);
        filtersContainer.appendChild(laneInputBox);
        filtersContainer.appendChild(printButton);
        filtersContainer.appendChild(rowCountDisplay);

        containermain.appendChild(button);
        containermain.appendChild(filtersContainer);
        document.body.appendChild(containermain);
    }

    // Funzione per aggiornare ogni 5 minuti
    setInterval(function() {
        if (isDataFetched) {
            fetchData(1); // Per esempio, recuperiamo i dati per l'ora corrente ogni 5 minuti
        }
    }, 300000); // 300000ms = 5 minuti

    createButtons();
})();


// SCARICHI
(function () {
    'use strict';

    let tableVisible = false; // Stato della tabella
    let dataContainer; // Variabile per il container
    let isDataLoaded = false; // Flag per sapere se i dati sono stati caricati

    function loadYardPageAndExtractData(callback) {
        // Rimuovi eventuali iframe esistenti
        const existingIframe = document.querySelector('iframe[data-yard="true"]');
        if (existingIframe) {
            existingIframe.remove();
        }

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none'; // Nasconde l'iframe
        iframe.setAttribute('data-yard', 'true'); // Per identificare facilmente questo iframe
        iframe.src = "https://trans-logistics-eu.amazon.com/yms/shipclerk";

        iframe.onload = function () {
            setTimeout(() => {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (!iframeDoc) {
                    console.error("Impossibile accedere al contenuto dell'iframe.");
                    callback([]);
                    return;
                }

                // Seleziona tutte le righe
                const rows = iframeDoc.querySelectorAll('tr');
                const data = [];

                rows.forEach(row => {
                    const col1 = row.querySelector('td.col1'); // Location
                    const col8 = row.querySelector('td.col8'); // DSSMITH check
                    const col9 = row.querySelector('td.col9'); // Tipo di Transfer
                    const col11 = row.querySelector('td.col11'); // Note da mostrare
                    const tractorIcon = row.querySelector('.yard-asset-icon.yard-asset-icon-TRACTOR'); // Icona del Tractor

                    // Se col1, col9 e col11 esistono
                    if (col1 && col9 && col11) {
                         const location = col1.innerText.trim(); // Testo della colonna Location
    let note = col11.innerText.trim(); // Testo della colonna Note (col11)
    const isTractorPresent = tractorIcon !== null; // Verifica se l'icona Tractor è presente

    // Caso 1: Se col9 contiene "TransfersCarts", aggiungi la riga con la location e la nota
    if (/TransfersCarts/i.test(col9?.innerText || '')) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor

    // Caso 2: Se col9 contiene "Transfer" ma non "TransfersCarts", aggiungi la riga solo se "Ricarica" è nelle note
    } else if (/Transfers/i.test(col9?.innerText || '') && /Ricarica/i.test(note)) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor

    // Caso 3: Se col11 contiene "Ricarica" e col9 è vuoto
    } else if (!col9?.innerText.trim() && /Ricarica/i.test(note)) {
        data.push([location, note, isTractorPresent, false]); // Aggiungi Location, Note, presenza del Tractor
    }

    // Caso 4: Se col8 contiene "DSSMITH", cambia le note in "Non Inventory"
  if (col8 && (/DSSMITH/i.test(col8.innerText) || /ZETAC/i.test(col8.innerText))) {
    note = "Non Inventory"; // Cambia le note in "Non Inventory"
    data.push([location, note, isTractorPresent, true]); // Aggiungi Location e le nuove note, ignorando la col8
}
}
                });

                console.log("Dati filtrati:", data);
                callback(data);

                // Rimuove l'iframe dopo l'elaborazione
                iframe.remove();
            }, 5000); // Aspetta 5 secondi
        };

        document.body.appendChild(iframe);
    }

    function displayData(data) {
        // Pulisci il contenuto del container
        dataContainer.innerHTML = "";

        // Crea una tabella per visualizzare i dati
        const dataTable = document.createElement('table');
        dataTable.style.borderCollapse = 'collapse';
        dataTable.style.fontSize = '14px';
        dataTable.style.fontFamily = 'Arial, sans-serif';
        dataTable.style.textAlign = 'left';
        dataTable.style.border = '1px solid #ddd';
        dataTable.style.width = 'auto';

        const thead = dataTable.createTHead();
        const tbody = dataTable.createTBody();

        // Intestazione
        const headerRow = thead.insertRow();
        const th1 = document.createElement('th');
        th1.textContent = "Location";
        headerRow.appendChild(th1);

        const th2 = document.createElement('th');
        th2.textContent = "Note";
        headerRow.appendChild(th2);

        [th1, th2].forEach(th => {
            th.style.padding = '8px';
            th.style.border = '1px solid #ddd';
            th.style.backgroundColor = '#f4f4f4';
            th.style.color = '#333';
        });

        if (data.length === 0) {
            // Aggiungi una riga con il messaggio di avviso
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2; // Span su entrambe le colonne
            cell.textContent = "ATTENZIONE, NON CI SONO JP CARTS SUL FLOOR E NEMMENO NELLO YARD!!!";
            cell.style.color = 'red';
            cell.style.fontWeight = 'bold';
            cell.style.textAlign = 'center';
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
        } else {
            // Aggiungi le righe dei dati
            data.forEach(rowData => {
                const row = tbody.insertRow();

                // Cella Location
                const firstTd = row.insertCell();
                firstTd.textContent = rowData[0]; // Location

                // Aggiungi il pallino verde accanto alla Location se il Tractor è presente
                if (rowData[2]) {
                    const dot = document.createElement('span');
                    dot.style.display = 'inline-block';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.backgroundColor = 'green';
                    dot.style.marginLeft = '10px';
                    dot.style.animation = 'blink 1s infinite';
                    firstTd.appendChild(dot);
                }

                // Cella Note
                const lastTd = row.insertCell();
                lastTd.textContent = rowData[1]; // Note (col11) o "Non Inventory" se DSSMITH

                [firstTd, lastTd].forEach(td => {
                    td.style.padding = '8px';
                    td.style.border = '1px solid #ddd';
                    td.style.whiteSpace = 'nowrap'; // Impedisce il wrapping
                });
            });
        }

        dataContainer.appendChild(dataTable); // Aggiungi la tabella al container

        // Impostiamo il flag che i dati sono stati caricati
        isDataLoaded = true;

        // Mostra il container
        dataContainer.style.display = 'block';
    }

    function toggleDataDisplay() {
        if (tableVisible) {
            dataContainer.style.display = 'none';
            button.textContent = "Mostra Scarichi";
        } else {
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
            button.textContent = "Nascondi Scarichi";
        }
        tableVisible = !tableVisible;
    }

    setInterval(() => {
        if (tableVisible) {
            console.log("Esecuzione auto-refresh");
            loadYardPageAndExtractData(function (data) {
                displayData(data);
            });
        }
    }, 10 * 60 * 1000); // 10 minuti

    const button = document.createElement('button');
    button.textContent = "Mostra Scarichi";
    button.style.position = 'fixed';
    button.style.top = '550px';
    button.style.left = '10px';
    button.style.padding = '10px';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';

    dataContainer = document.createElement('div');
    dataContainer.style.position = 'fixed';
    dataContainer.style.top = '600px';
    dataContainer.style.left = '10px';
    dataContainer.style.backgroundColor = 'white';
    dataContainer.style.border = '1px solid #ddd';
    dataContainer.style.borderRadius = '5px';
    dataContainer.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    dataContainer.style.padding = '10px';
    dataContainer.style.display = 'none';
    dataContainer.style.zIndex = '999';

    // Aggiungi l'animazione per il lampeggio del pallino verde
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.2; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    button.addEventListener('click', toggleDataDisplay);

    document.body.appendChild(button);
    document.body.appendChild(dataContainer);
})();

// DOCK CONGESTION
(function() {
    'use strict';

    // Function to fetch and display data
    function fetchAndDisplayData() {
        // URL parameters
        const params = {
            _enabledColumns: "on",
            WorkPool: "ManifestPending",
            enabledColumns: [
                "ASIN_TITLES",
                "FC_SKU",
                "LAST_EXSD",
                "LPN",
                "OUTER_SCANNABLE_ID",
                "SORT_CODE",
                "FULFILLMENT_REFERENCE_ID",
                "OUTER_OUTER_CONTAINER_TYPE",
                "OUTER_OUTER_SCANNABLE_ID",
                "STACKING_FILTER",
                "LABEL",
                "SSP_STATE",
                "TRAILER"
            ].join(','),
            ExSDRange_RangeStartMillis: "1731643199999", // Make sure these are correct
            ExSDRange_RangeEndMillis: "1734064260000",   // Make sure these are correct
            Fracs: "NON_FRACS",
            shipmentType: "CUSTOMER_SHIPMENTS"
        };

        // Convert params to query string
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        // Full URL
        const apiUrl = `https://rodeo-dub.amazon.com/MXP6/ItemList?${queryString}`;

        // Fetch data using GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Try to locate the element containing the result (fix the selector)
                    const totalResultsElement = doc.querySelector('.shipment-list.warn-pagination.pager-result-size');
                    let totalResults = 0;

                    if (totalResultsElement) {
                        // Assuming the number is contained within the element as text
                        totalResults = parseInt(totalResultsElement.textContent.trim().replace(/[^0-9]/g, ''));
                        console.log(`Total Results: ${totalResults}`);
                    } else {
                        console.warn('Element with the results not found!');
                    }

                    // Create or update the table to display the results
                    let tableContainer = document.getElementById('dockCongestionTable');
                    if (!tableContainer) {
                        // Create the table if it doesn't exist
                        tableContainer = document.createElement('div');
                        tableContainer.id = 'dockCongestionTable';
                        tableContainer.style.position = 'fixed';
                        tableContainer.style.top = '25%';
                        tableContainer.style.left = '40%';
                        tableContainer.style.transform = 'translate(-50%, -50%)';
                        tableContainer.style.backgroundColor = 'white';
                        tableContainer.style.border = '2px solid #ccc';
                        tableContainer.style.padding = '20px';
                        tableContainer.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.1)';
                        tableContainer.style.zIndex = '9999';
                        tableContainer.style.textAlign = 'center';

                        const table = document.createElement('table');
                        table.style.margin = '0 auto';
                        table.style.borderCollapse = 'collapse';
                        const header = document.createElement('thead');
                        const headerRow = document.createElement('tr');
                        headerRow.innerHTML = '<th colspan="2">DOCK CONGESTION</th>';
                        header.appendChild(headerRow);
                        table.appendChild(header);

                        const tbody = document.createElement('tbody');
                        const row = document.createElement('tr');
                        const statusCell = document.createElement('td');
                        statusCell.setAttribute('colspan', '2');
                        statusCell.style.fontSize = '18px';

                        row.appendChild(statusCell);
                        tbody.appendChild(row);
                        table.appendChild(tbody);
                        tableContainer.appendChild(table);
                        document.body.appendChild(tableContainer);
                    }

                    // Update the status cell with the total results and the appropriate color/status
                    const statusCell = tableContainer.querySelector('td');
                    let statusText = '';
                    if (totalResults <= 125000) {
                        statusCell.style.color = 'green';
                        statusText = `Dock OK: ${totalResults.toLocaleString()}`; // Adds commas for readability
                    } else if (totalResults <= 150000) {
                        statusCell.style.color = 'orange';
                        statusText = `Contingency: ${totalResults.toLocaleString()}`;
                    } else {
                        statusCell.style.color = 'red';
                        statusCell.style.fontWeight = 'bold';
                        statusText = `Safety Issue: ${totalResults.toLocaleString()}`;
                    }

                    // Update the table with the status text
                    statusCell.textContent = statusText;

                } else {
                    console.error(`HTTP error! status: ${response.status}`);
                }
            },
            onerror: function(error) {
                console.error('Error fetching data:', error);
            }
        });
    }

    // Fetch and display data initially
    fetchAndDisplayData();

    // Update the data every 5 minutes (300000 ms)
    setInterval(fetchAndDisplayData, 300000);

})();
