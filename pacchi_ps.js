
(function() {
    'use strict';

    const url = 'https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria';
    let previousCptMap = {}; // Memorizziamo lo stato precedente dei dati
    let notifiedCpts = {}; // Oggetto per tracciare le notifiche per ogni CPT e orario
    let isFirstFetch = true; // Flag per evitare notifiche al primo caricamento

    function fetchDataAndCheckForNewPackages() {
        const endTime = new Date().getTime();
        const startTime = endTime - 48 * 60 * 60 * 1000; // 48 ore fa
        const sonObj = {
            "entity": "getContainersDetailByCriteria",
            "nodeId": "MXP6",
            "timeBucket": {
                "fieldName": "physicalLocationMoveTimestamp",
                startTime: startTime,
                endTime: endTime
            },
            "filterBy": {
                "state": ["slam", "InFacilityReceived", "problemSolve", "Diverted", "jackpot", "Total"],
                "isMissing": [false]
            },
            "containerTypes": ["PACKAGE"],
            "fetchCompoundContainerDetails": false,
            "includeCriticalCptEnclosingContainers": false
        };

        GM_xmlhttpRequest({
            method: 'GET',
            url: `${url}?jsonObj=${encodeURIComponent(JSON.stringify(sonObj))}`,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const containers = data?.ret?.getContainersDetailByCriteriaOutput?.containerDetails?.[0]?.containerDetails || [];
                        const filteredContainers = containers.filter(container =>
                            container.location === "Runner_01" || container.location === "Pacchi Auditor" || container.location === "SLAM STATION-908" || container.location === "SLAM STATION-901" || container.location === "SLAM STATION-905"
                        );

                        const cptMap = groupContainersByCpt(filteredContainers);

                        if (isFirstFetch) {
                            createTableWithData(cptMap);
                        } else {
                            notifyDifferences(previousCptMap, cptMap);
                            updateTable(cptMap);
                        }

                        previousCptMap = JSON.parse(JSON.stringify(cptMap));
                        isFirstFetch = false;
                    } catch (error) {
                        console.error('Errore nel parsing dei dati:', error);
                    }
                } else {
                    console.error('Errore nella richiesta:', response.status, response.statusText);
                }
            },
            onerror: function(err) {
                console.error('Errore nella richiesta:', err);
            }
        });
    }

    function groupContainersByCpt(containers) {
        const cptMap = {};

        containers.forEach(container => {
            const route = container.route;
            const location = container.location;
            const cpt = container.cpt;

            if (!cptMap[cpt]) {
                cptMap[cpt] = [];
            }

            cptMap[cpt].push({
                route: route,
                location: location,
                cpt: cpt
            });
        });

        return cptMap;
    }

    function createTableWithData(cptMap) {
        const container = document.createElement('div');
        container.style.marginTop = '20px';
        container.id = 'package-table-container';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.border = '1px solid #ddd';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.backgroundColor = '#fff';
        container.appendChild(table);

        const header = document.createElement('thead');
        header.innerHTML = `
            <tr style="background-color: #2C3E50; color: white;">
                <th style="border: 1px solid #ddd; padding: 8px;" colspan="4">Pacchi da recuperare</th>
            </tr>
        `;
        table.appendChild(header);

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        populateTableBody(cptMap, tbody);
        document.body.appendChild(container);
    }

    function populateTableBody(cptMap, tbody) {
        const sortedContainers = Object.keys(cptMap).sort((a, b) => a - b);

        sortedContainers.forEach(cpt => {
            const cptRow = document.createElement('tr');
            cptRow.style.cursor = 'pointer';
            cptRow.style.backgroundColor = 'lightblue';
            cptRow.setAttribute('data-cpt', cpt);
            const formattedCptTime = convertToRomeTimeWithoutSeconds(Number(cpt));
            cptRow.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;" colspan="4">${formattedCptTime}</td>
            `;
            tbody.appendChild(cptRow);

            const locationMap = {};

            cptMap[cpt].forEach(container => {
                const routeLocation = container.route + ' - ' + container.location;
                if (!locationMap[routeLocation]) {
                    locationMap[routeLocation] = 0;
                }
                locationMap[routeLocation] += 1;
            });

            Object.keys(locationMap).forEach(routeLocation => {
                const routeLocationRow = document.createElement('tr');
                routeLocationRow.style.display = 'none';
                routeLocationRow.setAttribute('data-route-location', routeLocation);
                routeLocationRow.innerHTML = `
                    <td style="border: 1px solid #ddd; padding: 8px;">${routeLocation.split(' - ')[0]}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${routeLocation.split(' - ')[1]}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${locationMap[routeLocation]}</td>
                `;
                tbody.appendChild(routeLocationRow);

                cptRow.addEventListener('click', () => {
                    routeLocationRow.style.display = (routeLocationRow.style.display === 'none') ? '' : 'none';
                });
            });
        });
    }

    function notifyDifferences(oldMap, newMap) {
        Object.keys(newMap).forEach(cpt => {
            const oldContainers = oldMap[cpt] || [];
            const newContainers = newMap[cpt];

            // Verifica se ci sono modifiche
            if (JSON.stringify(oldContainers) !== JSON.stringify(newContainers)) {
                const locations = new Set();
                newContainers.forEach(container => {
                    locations.add(container.location); // Aggiungiamo ogni location unica per questo CPT
                });

                // Per ogni modifica di CPT, invia una notifica separata
                newContainers.forEach(container => {
                    const formattedCptTime = convertToRomeTimeWithoutSeconds(Number(container.cpt));
                    if (!notifiedCpts[cpt]) {
                        notifiedCpts[cpt] = new Set();
                    }
                    if (!notifiedCpts[cpt].has(formattedCptTime)) {
                        GM_notification({
                            title: 'Nuovi pacchi',
                            text: `La route ${container.route} ha nuovi pacchi nella location ${container.location} (CPT ${formattedCptTime})`,
                            timeout: 5000,
                            onclick: () => {
                                console.log('Notifica cliccata:', cpt);
                            }
                        });
                        notifiedCpts[cpt].add(formattedCptTime); // Aggiungi l'ora alla lista delle notifiche inviate per questo CPT
                    }
                });
            }
        });
    }

    function updateTable(cptMap) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        populateTableBody(cptMap, tbody);
    }

    function convertToRomeTimeWithoutSeconds(timestamp) {
        const date = new Date(timestamp);
        date.setSeconds(0, 0);

        const options = {
            timeZone: 'Europe/Rome',
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };

        return new Intl.DateTimeFormat('it-IT', options).format(date).replace(',', ''); // formato desiderato "DD/MM/YY, HH:mm"
    }

    fetchDataAndCheckForNewPackages();
    setInterval(fetchDataAndCheckForNewPackages, 60 * 1000);
})();
