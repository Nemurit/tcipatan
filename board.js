(function() {
    'use strict';

    const nodeId = 'MXP6';
    const stackingFilterMapUrl = 'https://raw.githubusercontent.com/Nemurit/tcipatan/refs/heads/main/stacking_filter_map.json';
    let selectedBufferFilter = '';
    let selectedLaneFilters = [];
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

                        // Cerca il contenitore specifico
                        const specificContainer = containers.find(container => container.location === 'CART_00jw9edr_S');
                        if (specificContainer) {
                            console.log("Dettagli del contenitore specifico trovato:", specificContainer);
                        } else {
                            console.warn("Il contenitore specificato non è stato trovato nella risposta.");
                        }

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
            
            const pacchi = parseInt(container.Contentcount, 10) || 0;
            console.log(`Processing container: location = ${location}, stackingFilter = ${stackingFilter}, lane = ${lane}, pacchi = ${pacchi}`);
        
            if (
                location.toUpperCase().startsWith("BUFFER") &&
                (selectedBufferFilter === '' || matchesExactBufferNumber(location, selectedBufferFilter)) &&
                (selectedLaneFilters.length === 0 || selectedLaneFilters.some(laneFilter => lane.toUpperCase().includes(laneFilter.toUpperCase())))
            ) {
                console.log(`Container ${location} matches filters.`);
        
                if (!filteredSummary[lane]) {
                    filteredSummary[lane] = {};
                    console.log(`Created new lane entry: ${lane}`);
                }
        
                if (!filteredSummary[lane][location]) {
                    filteredSummary[lane][location] = { count: 0, totalPacchi: 0 };
                    console.log(`Created new location entry: ${location} for lane: ${lane}`);
                }
        
                filteredSummary[lane][location].count++;
                filteredSummary[lane][location].totalPacchi += pacchi;
                console.log(`Updated ${location} in lane ${lane}: count = ${filteredSummary[lane][location].count}, totalPacchi = ${filteredSummary[lane][location].totalPacchi}`);
            } else {
                console.log(`Container ${location} does not match filters.`);
            }
        });

        console.log("Filtered Summary before sorting:");
        console.log(filteredSummary);

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

        console.log("Sorted Summary:");
        console.log(sortedSummary);

        if (isVisible) {
            displayTable(sortedSummary);
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

    function displayTable(sortedSummary) {
        // Implementazione come prima...
    }

    function addToggleButton() {
        // Implementazione come prima...
    }

    fetchStackingFilterMap(function() {
        addToggleButton();
        fetchBufferSummary();
    });

    setInterval(fetchBufferSummary, 200000);
})();
