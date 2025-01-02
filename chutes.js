(function() {
    'use strict';

    const API_URL = "https://trans-logistics-eu.amazon.com/sortcenter/vista/controller/getContainersDetailByCriteria";
    const CHECK_INTERVAL = 15 * 60 * 1000; // 1 minuto
    const previousChildCounts = {};  // Memorizza i contatori di bambini dei contenitori "Stacked"
    const previousLocations = {};  // Memorizza le location precedenti dei contenitori "Stacked"
    const stackingFilters = {};  // Memorizza i stackingFilter dei contenitori "Stacked"
    const divertedStackingFilters = {};  // Memorizza i stackingFilter dei contenitori "Diverted"
    let containersStacked = [];  // Memorizza i contenitori "Stacked"
    let containersDiverted = [];  // Memorizza i contenitori "Diverted"
    let popupVisible = false;  // Stato del popup, inizialmente non visibile

    // Funzione per fare la richiesta API
    function fetchContainers() {
        const endTime = new Date().getTime();
        const startTime = endTime - 48 * 60 * 60 * 1000;

        const payload = {
            entity: "getContainersDetailByCriteria",
            nodeId: "MXP6",
            timeBucket: {
                fieldName: "physicalLocationMoveTimestamp",
                startTime: startTime,
                endTime: endTime
            },
            filterBy: {
                state: ["Stacked"],
                isClosed: [false],
                isMissing: [false]
            },
            containerTypes: ["PALLET", "GAYLORD", "BAG", "CART"],
            fetchCompoundContainerDetails: true,
            includeCriticalCptEnclosingContainers: false
        };

        GM_xmlhttpRequest({
            method: "GET",
            url: `${API_URL}?${new URLSearchParams({ jsonObj: JSON.stringify(payload) })}`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails;
                        processContainers(containers);
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

    // Funzione per la seconda richiesta API "Diverted"
    function fetchDivertedContainers() {
        const endTime = new Date().getTime();
        const startTime = endTime - 48 * 60 * 60 * 1000;

        const payload = {
            entity: "getContainersDetailByCriteria",
            nodeId: "MXP6",
            timeBucket: {
                fieldName: "physicalLocationMoveTimestamp",
                startTime: startTime,
                endTime: endTime
            },
            filterBy: {
                state: ["slam", "InFacilityReceived", "problemSolve", "Diverted", "jackpot", "Total"],
                isMissing: [false]
            },
            containerTypes: ["PACKAGE"],
            fetchCompoundContainerDetails: false,
            includeCriticalCptEnclosingContainers: false
        };

        GM_xmlhttpRequest({
            method: "GET",
            url: `${API_URL}?${new URLSearchParams({ jsonObj: JSON.stringify(payload) })}`,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails;
                        processDivertedContainers(containers);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API (Diverted).");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API (Diverted):", error);
                }
            },
            onerror: function(error) {
                console.error("Errore nella chiamata API (Diverted):", error);
            }
        });
    }

 // Aggiungi una struttura per memorizzare i timestamp delle ultime modifiche
const lastModificationTimestamps = {};

// Aggiorna la funzione processContainers
function processContainers(containers) {
    const currentTime = new Date().getTime();

    containers.forEach(containerGroup => {
        containerGroup.containerDetails.forEach(container => {
            const stackingFilter = container.stackingFilter;
            const location = container.location;
            const containerId = container.id;
            const childCount = container.childCount;

            // Salva i dati relativi ai contenitori "Stacked"
            containersStacked.push({
                containerId,
                stackingFilter,
                location,
                childCount
            });

            // Memorizza stackingFilter dei contenitori "Stacked"
            stackingFilters[stackingFilter] = stackingFilter;

            // Verifica se il childCount è cambiato
            if (previousChildCounts[containerId] !== undefined && previousChildCounts[containerId] !== childCount) {
                // Il childCount è cambiato, aggiorna il timestamp
                lastModificationTimestamps[containerId] = currentTime;
            } else if (lastModificationTimestamps[containerId] === undefined) {
                // Imposta il timestamp iniziale se non esiste
                lastModificationTimestamps[containerId] = currentTime;
            }

            previousChildCounts[containerId] = childCount;  // Salva il nuovo childCount
        });
    });

    // Filtra e mostra solo i contenitori "Stacked" che hanno stackingFilter che combaciano con quelli dei "Diverted"
    updateTable();
}
    // Funzione per processare i containers "Diverted"
    function processDivertedContainers(response) {
        const containers = response[0].containerDetails;

        if (containers && containers.length > 0) {
            containers.forEach(container => {
                const stackingFilter = container.stackingFilter;

                // Salva i stackingFilter dei contenitori "Diverted"
                divertedStackingFilters[stackingFilter] = stackingFilter;
            });
        }

        // Filtra e mostra solo i contenitori "Stacked" che hanno stackingFilter che combaciano con quelli dei "Diverted"
        updateTable();
    }

    function updateTable() {
        const containerDiv = document.getElementById("containersTableContainer");
        if (!containerDiv) {
            const newDiv = document.createElement("div");
            newDiv.style.display = "none"; // Nascondi il contenitore
            newDiv.id = "containersTableContainer";
            newDiv.style.position = "absolute";
            newDiv.style.top = "100px";
            newDiv.style.right = "50px"; // Sposta a destra
            newDiv.style.backgroundColor = "#1f1f1f";
            newDiv.style.border = "1px solid #444";
            newDiv.style.padding = "10px";
            newDiv.style.maxHeight = "500px";
            newDiv.style.overflowY = "auto";
            newDiv.style.opacity = "0.99"; // Tabella principale opaca al 99%
            document.body.appendChild(newDiv);
        }

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.color = "#dcdcdc";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Stacking Filter", "Chute", "# Pacchi"].forEach(text => {
            const headerCell = document.createElement("th");
            headerCell.textContent = text;
            headerCell.style.padding = "10px";
            headerCell.style.borderBottom = "1px solid #333";
            headerRow.appendChild(headerCell);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        const addedContainers = {};

        containersStacked.forEach(container => {
            if (divertedStackingFilters[container.stackingFilter] && !addedContainers[container.containerId]) {
                const row = tbody.insertRow();
                [container.stackingFilter, container.location, container.childCount].forEach(text => {
                    const cell = row.insertCell();
                    cell.textContent = text;
                    cell.style.padding = "10px";
                    cell.style.borderBottom = "1px solid #333";
                });
                addedContainers[container.containerId] = true;
            }
        });

    table.appendChild(tbody);

    // Aggiungi la tabella al contenitore
    containerDiv.innerHTML = ""; // Pulisce il contenitore precedente
    containerDiv.appendChild(table);

    // Se ci sono location invariabili, mostra la seconda tabella
    showLocationTable();
}

// Modifica la funzione showLocationTable
function showLocationTable() {
    const currentTime = new Date().getTime();
    const inactiveTimeThreshold = 15 * 60 * 1000; // 15 minuti

    const unchangedContainers = containersStacked.filter(container => {
        return (
            divertedStackingFilters[container.stackingFilter] &&
            previousChildCounts[container.containerId] === container.childCount &&
            currentTime - lastModificationTimestamps[container.containerId] >= inactiveTimeThreshold
        );
    });

    // Controlla se ci sono contenitori invariabili da visualizzare nel popup
    if (unchangedContainers.length > 0) {
        // Crea o aggiorna il popup solo se non è già visibile
        if (!popupVisible) {
            const popupWidth = 400;
            const popupHeight = 500;
            const popupLeft = (screen.width / 2) - (popupWidth / 2);
            const popupTop = (screen.height / 2) - (popupHeight / 2);

            // Verifica se la finestra esiste già
            if (!window.locationPopup || window.locationPopup.closed) {
                window.locationPopup = window.open(
                    "",
                    "LocationPopup",
                    `width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop},resizable,scrollbars`
                );
            }

            // Forza la finestra in primo piano
            try {
                window.locationPopup.focus();
            } catch (e) {
                console.error("Impossibile portare il popup in primo piano:", e);
            }

            // Scrivi il contenuto del popup
            const popupDocument = window.locationPopup.document;
            popupDocument.body.innerHTML = ""; // Pulisci il contenuto precedente

            // Aggiungi uno stile moderno al popup
            const style = `
                body {
                    font-family: Arial, sans-serif;
                    background-color: #1f1f1f;
                    color: #ffffff;
                    margin: 0;
                    padding: 20px;
                    overflow-y: auto;
                }
                h3 {
                    text-align: center;
                    color: #ffa500;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #444;
                    padding-bottom: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    text-align: left;
                    padding: 10px;
                    border-bottom: 1px solid #333;
                    color: #dcdcdc;
                }
                .close-button {
                    position: fixed;
                    top: 10px;
                    right: 15px;
                    font-size: 20px;
                    font-weight: bold;
                    color: #ff5555;
                    cursor: pointer;
                }
                .close-button:hover {
                    color: #ff8888;
                }
            `;
            const styleElement = popupDocument.createElement("style");
            styleElement.textContent = style;
            popupDocument.head.appendChild(styleElement);

            // Aggiungi la "X" di chiusura
            const closeButton = popupDocument.createElement("span");
            closeButton.textContent = "×";
            closeButton.className = "close-button";
            closeButton.onclick = () => {
                window.locationPopup.close();
                popupVisible = false; // Imposta popupVisible a false quando il popup è chiuso
            };
            popupDocument.body.appendChild(closeButton);

            // Aggiungi il titolo del popup
            const title = popupDocument.createElement("h3");
            title.textContent = "Chute innative (15 min)";
            popupDocument.body.appendChild(title);

            // Crea la tabella
            const table = popupDocument.createElement("table");

            // Crea il corpo della tabella
            const tbody = popupDocument.createElement("tbody");
            const addedLocations = {}; // Per evitare duplicati

            unchangedContainers.forEach(container => {
                if (!addedLocations[container.location]) {
                    const row = tbody.insertRow();
                    const cell = row.insertCell();
                    cell.textContent = container.location;
                    addedLocations[container.location] = true;
                }
            });

            table.appendChild(tbody);
            popupDocument.body.appendChild(table);

            // Imposta lo stato del popup come visibile
            popupVisible = true;
        }
    }
}



    // Esegui il fetch iniziale e il controllo ogni minuto
    setInterval(() => {
        fetchContainers();
        fetchDivertedContainers();
    }, CHECK_INTERVAL);

    fetchContainers();
    fetchDivertedContainers();

})();
