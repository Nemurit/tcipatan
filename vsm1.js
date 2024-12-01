function getSTEM() {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://stem-eu.corp.amazon.com/node/MXP6/equipment",
            onload: function (response) {
                const placeholder = document.createElement('div');
                placeholder.innerHTML = response.responseText;
                var token = placeholder.querySelector("input").value;
                var epoch = Date.now() - 1000;
                let poster = [{"operationName":"VisualSortationMarkers","variables":{"nodeId":"MXP6","asOfTime":"" + epoch + ""},"query":"query VisualSortationMarkers($nodeId: String!, $asOfTime: String!) {\n  visualSortationMarkers(nodeId: $nodeId, asOfTime: $asOfTime) {\n    visualMarkers {\n      visualMarker\n    }\n    stackingFilter\n  }\n}\n"}]
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://stem-eu.corp.amazon.com/sortcenter/equipmentmanagement/graphql",
                    data: JSON.stringify(poster),
                    headers: {
                        "Accept" :"*/*",
                        "anti-csrftoken-a2z" :	token,
                        "content-type" : "application/json"
                    },
                    onload: function (response) {
                        var obj = [];
                        var data = JSON.parse(response.responseText);
                        var vsmArray = data[0].data.visualSortationMarkers;
                        for (var i = 0; i < vsmArray.length; i++) {
                            var visualMarker = vsmArray[i].visualMarkers[0].visualMarker;
                            var stackingFilter = vsmArray[i].stackingFilter;
                            _vsmDict[stackingFilter] = visualMarker;
                        }
                        setInterval(findAndModify, 1000);
                    }
                })
            }
        })
    }

    function findAndModify() {
        const elements = document.querySelectorAll('.colSFilter');

        for (const element of elements) {
            if (!element.classList.contains('addedVSM')) {
                element.classList.add('addedVSM');
                if (element.textContent.trim() !== "" && !element.textContent.trim().startsWith("MXP6->")) {
                    console.log(_vsmDict[element.innerHTML], _vsmDict[element.innerHTML] === undefined);
                    let vsm = _vsmDict[element.innerHTML] !== undefined ? _vsmDict[element.innerHTML] : "N/A";
                    let vsmElement = document.createElement('strong');
                    vsmElement.style.color = 'red';
                    let textNode = document.createTextNode(vsm);
                    vsmElement.appendChild(textNode);
                    element.innerHTML += ' / ';
                    element.appendChild(vsmElement);
                    //element.innerHTML += '<br>VSM: ' + vsm;
                }
            }
        }
    }
