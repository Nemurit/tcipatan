(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
    let stackingToLaneMap = {};
    let selectedTimeFilter = ''; // Time filter
    let isVisible = false;

    // Add the toggle button to the page
    function addToggleButton() {
        const button = $('<button id="toggleTableButton" style="position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Toggle Table</button>');
        button.on('click', toggleTableVisibility);
        $('body').append(button);
    }

    // Fetch the stacking filter map (mapping stacking filters to lanes)
    function fetchStackingFilterMap(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: stackingFilterMapUrl,
            onload: function(response) {
                try {
                    const laneData = JSON.parse(response.responseText);
                    console.log('Lane Data:', laneData); // Log the lane data to ensure it's correct

                    // Build the stackingToLaneMap
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

    // Fetch container data and process it
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
                    console.log('API Response:', data); // Log the full API response

                    // Check if the data is structured correctly
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput && data.ret.getContainersDetailByCriteriaOutput.containerDetails) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        console.log('Containers:', containers); // Log the containers array

                        if (containers && containers.length > 0) {
                            processAndDisplay(containers);
                        } else {
                            console.warn("No containers found.");
                        }
                    } else {
                        console.error("API response structure is invalid or incomplete.", data);
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

    // Process and display the container data
    function processAndDisplay(containers) {
        const filteredSummary = {};

        containers.forEach(container => {
            const location = container.location || '';
            const stackingFilter = container.stackingFilter || 'N/A';
            const lane = stackingToLaneMap[stackingFilter] || 'N/A';
            const cpt = container.cpt ? new Date(container.cpt) : null; // Recupera il CPT e lo converte in oggetto Date

            // Filter the buffers
            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                }

                if (!filteredSummary[lane][location]) {
                    filteredSummary[lane][location] = { count: 0, cpt: [] };
                }

                filteredSummary[lane][location].count++;
                if (cpt) filteredSummary[lane][location].cpt.push(cpt); // Storing CPTs for each location
            }
        });

        const sortedSummary = filteredSummary || {}; // Ensure it's always an object
        if (Object.keys(sortedSummary).length === 0) {
            console.warn("No matching data found after filtering.");
            return;
        }

        // Proceed with sorting and displaying the data
        const sortedData = {};
        Object.keys(sortedSummary).forEach(lane => {
            const laneSummary = sortedSummary[lane];
            sortedData[lane] = Object.keys(laneSummary)
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
            displayTable(sortedData);
        }
    }

    // Function to convert the CPT date to HH:mm:ss DD/MM/YYYY format
    function formatCPT(date) {
        if (!date) return 'N/A';
        const optionsTime = { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const optionsDate = { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' };
        const time = date.toLocaleTimeString('it-IT', optionsTime);
        const dateStr = date.toLocaleDateString('it-IT', optionsDate);
        return `${time} ${dateStr}`;
    }

    // Function to match exact buffer number
    function matchesExactBufferNumber(location, filter) {
        const match = location.match(/BUFFER\s*[A-Za-z](\d+)/); // Trova la lettera seguita dal numero
        if (match) {
            const bufferNumber = match[1];  // Estrae il numero
            return bufferNumber === filter;  
        }
        return false;
    }

    // Function to parse buffer number for sorting
    function parseBufferNumber(bufferName) {
        const match = bufferName.match(/BUFFER\s*[A-Za-z](\d+)/);
        return match ? parseInt(match[1], 10) : 0;  // Estrae solo il numero
    }

    // Display the sorted data in a table format
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
                    <input id="laneFilterInput" type="text" placeholder="Filtro per LANE" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
                <th>
                    <input id="timeFilterInput" type="text" placeholder="Filtro per ORA (es. 14:30)" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </th>
            </tr>
        `);

        const tbody = $('<tbody></tbody>');
        Object.entries(sortedSummary).forEach(([lane, locations]) => {
            const laneRow = $('<tr></tr>');
            laneRow.append(`<td colspan="3"><strong>${lane}</strong></td>`);

            Object.entries(locations).forEach(([location, data]) => {
                tbody.append(`
                    <tr>
                        <td>${location}</td>
                        <td>${data.count}</td>
                        <td>${data.cpt.length > 0 ? data.cpt.map(formatCPT).join('<br>') : 'N/A'}</td>
                    </tr>
                `);
            });

            table.append(thead).append(tbody);
        });

        contentContainer.append(table);
        $('body').append(contentContainer);
    }

    // Show or hide the table based on isVisible
    function toggleTableVisibility() {
        isVisible = !isVisible;
        if (isVisible) {
            fetchBufferSummary();
        } else {
            $('#contentContainer').remove();
        }
    }

    // Initialize by fetching the stacking filter map
    fetchStackingFilterMap(() => {
        // Now fetch the buffer summary once the stacking filter map is loaded
        addToggleButton();
    });
})();
