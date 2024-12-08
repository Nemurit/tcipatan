(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    const bufferMacroAreasUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/buffer.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let selectedCptFilter = '';
    let stackingToLaneMap = {};
    let bufferMacroAreas = {};
    let isVisible = false;
    let isChartVisible = false;
    let filteredSummary = {};

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

    function fetchBufferMacroAreas(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: bufferMacroAreasUrl,
            onload: function(response) {
                try {
                    bufferMacroAreas = JSON.parse(response.responseText);
                    if (callback) callback();
                } catch (error) {
                    console.error("Errore nel parsing del file JSON delle macro-aree:", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nel caricamento del file JSON delle macro-aree:", error);
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
            containerTypes: ["PALLET", "GAYLORD", "CART"],
            includeFields: ["childCount"]
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
                        console.log("API Response:", JSON.stringify(data, null, 2));
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

    function matchesExactBufferString(location, filter) {
        const locationUpper = location.toUpperCase();
        const filterUpper = filter.toUpperCase();

        if (locationUpper.includes(filterUpper)) {
            return true;
        }

        const filterParts = filterUpper.split(' ').filter(Boolean);
        const locationParts = locationUpper.split(' ').filter(Boolean);

        if (filterParts.length === 2 && locationParts.length === 2) {
            const [filterLetter, filterNumber] = filterParts;
            const [locationLetter, locationNumber] = locationParts;
            return locationLetter === filterLetter && locationNumber === filterNumber;
        }

        if (filterParts.length === 1 && locationParts.length === 2) {
            const [filterLetterOrNumber] = filterParts;
            const [locationLetter, locationNumber] = locationParts;
            if (isNaN(filterLetterOrNumber)) {
                return locationLetter === filterLetterOrNumber;
            }
            return locationNumber === filterLetterOrNumber;
        }

        return false;
    }

    function processAndDisplay(containers) {
        const filteredSummary = {};
        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt || null;
            const macroArea = getMacroArea(location);

            if (location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferString(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase()))) &&
                (selectedCptFilter === '' || (cpt && filterCpt(cpt, selectedCptFilter)))) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                }
                if (!filteredSummary[lane][macroArea]) {
                    filteredSummary[lane][macroArea] = { count: 0, cpt: cpt };
                }
                filteredSummary[lane][macroArea].count++;
                if (!filteredSummary[lane][macroArea].cpt || cpt < filteredSummary[lane][macroArea].cpt) {
                    filteredSummary[lane][macroArea].cpt = cpt;
                }
            }
        });

        console.log("Filtered Summary:", filteredSummary);

        if (isVisible) {
            displayTable(filteredSummary);
        }

        if (Object.keys(filteredSummary).length > 0) {
            generatePieChart(filteredSummary);
        }
    }

    function getMacroArea(location) {
        for (const [macroArea, buffers] of Object.entries(bufferMacroAreas)) {
            if (buffers.some(buffer => location.toUpperCase().includes(buffer.toUpperCase()))) {
                return macroArea;
            }
        }
        return 'Other';
    }

    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*([A-Za-z]*)\s*(\d+)/);
        if (match) {
            return parseInt(match[2], 10);
        }
        return null;
    }

    function convertTimestampToLocalTime(timestamp) {
        const date = new Date(timestamp);
        const options = { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: '2-digit' };
        return date.toLocaleString('it-IT', options);
    }

    function filterCpt(cpt, filter) {
        try {
            const date = new Date(cpt);
            const cptLocalTime = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
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
            <tr>
                <th>Macro-Area</th>
                <th>Totale Container</th>
                <th>CPT</th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        let totalContainers = 0;

        Object.entries(filteredSummary).forEach(([lane, laneSummary]) => {
            let laneTotal = 0;
            Object.values(laneSummary).forEach(data => {
                laneTotal += data.count;
            });

            let laneColor = laneTotal <= 10 ? 'green' : laneTotal <= 30 ? 'orange' : 'red';

            const laneRow = $(`<tr class="laneRow" style="cursor: pointer;">
                <td colspan="3" style="font-weight: bold; text-align: left;">Lane: ${lane} - Totale: <span style="color: ${laneColor};">${laneTotal}</span></td>
            </tr>`);

            laneRow.on('click', function() {
                $(this).nextUntil('.laneRow').toggle();
            });

            tbody.append(laneRow);

            Object.entries(laneSummary).forEach(([macroArea, data]) => {
                const row = $('<tr class="locationRow"></tr>');
                row.append(`<td>${macroArea}</td>`);
                row.append(`<td>${data.count}</td>`);
                row.append(`<td>${data.cpt ? convertTimestampToLocalTime(data.cpt) : 'N/A'}</td>`);
                tbody.append(row);
            });

            totalContainers += laneTotal;
        });

        const tfoot = $('<tfoot></tfoot>');
        const globalTotalRow = $(`<tr><td colspan="3" style="text-align:right; font-weight: bold;">Totale Globale: ${totalContainers}</td></tr>`);
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
                    selectedCptFilter = '';
                    fetchBufferSummary();
                } else if (isValidCptFilter(newFilter)) {
                    selectedCptFilter = newFilter;
                    fetchBufferSummary();
                } else {
                    alert("Il filtro inserito non è valido. Usare valori come '16, 16:15, 16:30'.");
                }
            }
        });

        function isValidCptFilter(filter) {
            const parts = filter.split(',').map(f => f.trim());
            return parts.every(part => /^(\d{1,2}(:\d{2})?)$/.test(part));
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

    function generatePieChart(filteredSummary) {
        if (!filteredSummary || Object.keys(filteredSummary).length === 0) {
            console.warn("No data to generate the chart.");
            return;
        }

        let chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'chartContainer';
            chartContainer.style.display = 'none';
            chartContainer.style.position = 'fixed';
            chartContainer.style.top = '60px';
            chartContainer.style.left = '50%';
            chartContainer.style.transform = 'translateX(-50%)';
chartContainer.style.padding = '20px';
chartContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
chartContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
chartContainer.style.width = '500px';
chartContainer.style.maxWidth = '90%';
chartContainer.style.zIndex = '1000';
chartContainer.style.boxSizing = 'border-box';

const chartCanvas = document.createElement('canvas');
chartCanvas.id = 'myChart';
chartCanvas.style.width = '100%';
chartCanvas.style.height = '400px';
chartContainer.appendChild(chartCanvas);
document.body.appendChild(chartContainer);

function addChartToggleButton() {
  const button = $('<button id="toggleChartButton" style="position: fixed; top: 35px; left: calc(50% - 22px); padding: 10px; background: rgb(0, 123, 255); color: white; border: none; cursor: pointer; border-radius: 5px; font-size: 14px;">Mostra grafico recuperi</button>');
  button.on('click', function() {
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer.style.display === 'none') {
      chartContainer.style.display = 'block';
      generatePieChart(filteredSummary);
      $(this).text('Nascondi Grafico');
    } else {
      chartContainer.style.display = 'none';
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
