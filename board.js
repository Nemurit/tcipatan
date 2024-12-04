(function () {
    'use strict';

    const nodeId = 'MXP6'; // ID del nodo da cui estrarre i dati
    let isVisible = false;

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
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.ret && data.ret.getContainersDetailByCriteriaOutput) {
                        const containers = data.ret.getContainersDetailByCriteriaOutput.containerDetails[0].containerDetails;
                        calculateTotalBufferPackages(containers);
                    } else {
                        console.warn("Nessun dato trovato nella risposta API.");
                    }
                } catch (error) {
                    console.error("Errore nella risposta API:", error);
                }
            },
            onerror: function (error) {
                console.error("Errore nella chiamata API:", error);
            }
        });
    }

    function calculateTotalBufferPackages(containers) {
        let totalPackages = 0;

        // Calcola il totale dei pacchi nei buffer
        containers.forEach(container => {
            const location = container.location || '';
            if (location.toUpperCase().startsWith("BUFFER")) {
                const contentCount = container.contentCount || 0;
                totalPackages += contentCount;
            }
        });

        // Determina lo stato della congestione
        let congestionStatus = '';
        let color = '';

        if (totalPackages <= 125000) {
            congestionStatus = `DOCK CONGESTION OK (${totalPackages})`;
            color = 'green';
        } else if (totalPackages <= 150000) {
            congestionStatus = `DOCK CONGESTION IN CONTINGENCY (${totalPackages})`;
            color = 'orange';
        } else {
            congestionStatus = `DOCK CONGESTION SAFETY ISSUE (${totalPackages})`;
            color = 'red';
        }

        displayStatus(congestionStatus, color);
    }

    function displayStatus(congestionStatus, color) {
        $('#contentContainer').remove();

        const contentContainer = $('<div id="contentContainer" style="position: fixed; top: 10px; right: 10px; padding: 20px; background: white; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border: 1px solid #ddd; text-align: center;"></div>');
        const statusDiv = $(`<div style="font-size: 18px; font-weight: bold; color: ${color};">${congestionStatus}</div>`);

        contentContainer.append(statusDiv);
        $('body').append(contentContainer);
    }

    function addToggleButton() {
        const toggleButton = $('<button id="toggleButton" style="position: fixed; top: 10px; left: calc(50% - 20px); padding: 4px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mostra Totale Pacchi</button>');

        toggleButton.on('click', function () {
            isVisible = !isVisible;
            if (isVisible) {
                fetchBufferSummary();
                $(this).text("Nascondi Totale Pacchi");
            } else {
                $('#contentContainer').remove();
                $(this).text("Mostra Totale Pacchi");
            }
        });

        $('body').append(toggleButton);
    }

    addToggleButton();
})();
