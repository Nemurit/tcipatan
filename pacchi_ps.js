(function() {
    'use strict';

    const url = 'https://www.amazonlogistics.eu/sortcenter/vista/controller/getContainersDetailByCriteria';
    let previousCptMap = {}; // Memorizziamo lo stato precedente dei dati
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
                            updateOriginalTable(cptMap);
                            previousCptMap = JSON.parse(JSON.stringify(cptMap));
                            isFirstFetch = false;
                        } else {
                            const differences = getDifferences(previousCptMap, cptMap);
                            if (Object.keys(differences).length > 0) {
                                showTableInNewWindow(differences);
                            }
                            updateOriginalTable(cptMap);
                            previousCptMap = JSON.parse(JSON.stringify(cptMap));
                        }
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
        const currentTime = new Date().getTime();

        containers.forEach(container => {
            const route = container.route;
            const location = container.location;
            const cpt = container.cpt;

            if (Number(cpt) > currentTime) { // Filtra solo CPT con data futura
                if (!cptMap[cpt]) {
                    cptMap[cpt] = [];
                }

                cptMap[cpt].push({
                    route: route,
                    location: location,
                    cpt: cpt
                });
            }
        });

        return cptMap;
    }

    function getDifferences(oldMap, newMap) {
        const differences = {};

        Object.keys(newMap).forEach(cpt => {
            const oldContainers = oldMap[cpt] || [];
            const newContainers = newMap[cpt];

            const oldCountMap = countContainersByLocation(oldContainers);
            const newCountMap = countContainersByLocation(newContainers);

            const diffContainers = [];

            Object.keys(newCountMap).forEach(location => {
                const diff = newCountMap[location] - (oldCountMap[location] || 0);
                if (diff > 0) {
                    diffContainers.push({
                        route: location.split(' - ')[0],
                        location: location.split(' - ')[1],
                        count: diff
                    });
                }
            });

            if (diffContainers.length > 0) {
                differences[cpt] = diffContainers;
            }
        });

        return differences;
    }

    function countContainersByLocation(containers) {
        const countMap = {};

        containers.forEach(container => {
            const key = container.route + ' - ' + container.location;
            if (!countMap[key]) {
                countMap[key] = 0;
            }
            countMap[key] += 1;
        });

        return countMap;
    }

  function showTableInNewWindow(differences) {
    // Apre una nuova finestra separata
    const newWindow = window.open('', '_blank', 'width=800,height=600');

    // Verifica se la finestra è stata aperta correttamente
    if (!newWindow) {
        console.error('La finestra non è stata aperta. Verifica se i popup sono abilitati.');
        return;
    }

    // Rimuovi tutto il contenuto esistente nella finestra per evitare conflitti
    newWindow.document.body.innerHTML = '';

    // Imposta il titolo e lo stile della finestra
    newWindow.document.title = 'Modifiche Pacchi';
    newWindow.document.body.style.fontFamily = 'Arial, sans-serif';
    newWindow.document.body.style.backgroundColor = '#f4f4f4';
    newWindow.document.body.style.padding = '10px';

    // Crea il contenitore per la tabella
    const container = newWindow.document.createElement('div');
    const table = newWindow.document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #ddd';
    table.style.fontFamily = 'Arial, sans-serif';
    table.style.backgroundColor = '#fff';
    container.appendChild(table);

    // Crea l'intestazione della tabella
    const header = newWindow.document.createElement('thead');
    header.innerHTML = `
        <tr style="background-color: #2C3E50; color: white;">
            <th style="border: 1px solid #ddd; padding: 8px;" colspan="4">Modifiche Pacchi</th>
        </tr>
    `;
    table.appendChild(header);

    const tbody = newWindow.document.createElement('tbody');
    table.appendChild(tbody);

    // Ciclo sulle differenze per creare le righe della tabella
    Object.keys(differences).sort((a, b) => a - b).forEach(cpt => { // Ordine cronologico
        const formattedCptTime = convertToRomeTimeWithoutSeconds(Number(cpt));
        const cptRow = newWindow.document.createElement('tr');
        cptRow.style.cursor = 'pointer';
        cptRow.style.backgroundColor = 'lightblue';
        cptRow.setAttribute('data-cpt', cpt);
        cptRow.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px;" colspan="4">${formattedCptTime}</td>
        `;
        tbody.appendChild(cptRow);

        differences[cpt].forEach(diff => {
            const diffRow = newWindow.document.createElement('tr');
            diffRow.style.backgroundColor = 'red';
            diffRow.style.display = 'none';  // Nascondi di default
            diffRow.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;">${diff.route}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${diff.location}</td>
                <td style="border: 1px solid #ddd; padding: 8px;" colspan="2">${diff.count}</td>
            `;
            tbody.appendChild(diffRow);

            // Aggiungi evento click per mostrare/nascondere le righe
            cptRow.addEventListener('click', () => {
                diffRow.style.display = (diffRow.style.display === 'none') ? '' : 'none';
            });
        });
    });

    // Aggiungi il contenitore con la tabella alla finestra
    newWindow.document.body.appendChild(container);
}


   function updateOriginalTable(cptMap) {
    let container = document.getElementById('package-table-container');

    if (!container) {
        container = document.createElement('div');
        container.style.marginTop = '20px';
        container.id = 'package-table-container';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.bottom = '0';
        container.style.width = '300px';
        container.style.overflowY = 'auto';
        container.style.backgroundColor = '#f4f4f4';
        container.style.padding = '10px';
        document.body.appendChild(container);
    }

    container.innerHTML = '';

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

    Object.keys(cptMap).sort((a, b) => a - b).forEach(cpt => { // Ordine cronologico
        const formattedCptTime = convertToRomeTimeWithoutSeconds(Number(cpt));
        const cptRow = document.createElement('tr');
        cptRow.style.cursor = 'pointer';
        cptRow.style.backgroundColor = 'lightblue';
        cptRow.setAttribute('data-cpt', cpt);
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
            routeLocationRow.style.display = 'none';  // Nascondi di default
            routeLocationRow.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;">${routeLocation.split(' - ')[0]}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${routeLocation.split(' - ')[1]}</td>
                <td style="border: 1px solid #ddd; padding: 8px;" colspan="2">${locationMap[routeLocation]}</td>
            `;
            tbody.appendChild(routeLocationRow);

            cptRow.addEventListener('click', () => {
                routeLocationRow.style.display = (routeLocationRow.style.display === 'none') ? '' : 'none';
            });
        });
    });
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

