(function() {
    'use strict';
    GM_addStyle(`.search-pane {
                     border: 1px solid black;
                     display: inline-block;
                     padding: 5px;
                     border-radius: 10px;
                     }
                 .search-btn {
                     margin: 3px;
                     font-weight: bold;
                     }

                 /* Tooltip prep */
                 .tooltip {
                     position: relative;
                     display: inline-flex;
                     }
                 .tooltip-carrier{
                     position: relative;
                     }
                 .icon-seal {
                     width: 11px;
                     }
                 .icon-driver {
                     width: 22px;
                     height: 18px;
                     }
                 .icon-carrier {
                     }
                 .icon-phone {
                     width: 22px;
                     height: 18px;
                     margin-left: -1px;
                     margin-bottom: -6px;
                     background: transparent url(https://m.media-amazon.com/images/G/01/Help/pg-gacd-phone._V324592851_.png) no-repeat center;
                     background-size: 30px;
                     }
                 .icon-phone-pointer {
                     cursor: pointer;
                     }

                 /* Tooltip text */
                 .tooltip .tooltip-text {
                     font-size: 11px;
                     visibility: hidden;
                     display: inline;
                     background-color: black;
                     color: #fff;
                     text-align: center;
                     padding: 2px 7px 2px 7px;
                     border-radius: 4px;
                     position: absolute;
                     width: max-content;
                     }
                 .tooltip .seal-tooltip-text {
                     bottom: 120%;
                     right: -85%;
                     }
                 .tooltip .driver-tooltip-text {
                     bottom: 125%;
                     right: 1%;
                     }
                 .tooltip .carrier-tooltip-text {
                     bottom: 125%;
                     right: 10%;
                     }
                 .tooltip .driver-phone-tooltip-text {
                     bottom: 110%;
                     right: 5%;
                     }
                 .tooltip .optype-tooltip-text {
                 bottom: 125%;
                 right: 1%
                 }

             /* Add speech bubble arrow thing */
             .tooltip .tooltip-text::after {
                 content: " ";
                 position: absolute;
                 top: 100%;
                 right: 10%;
                 border-width: 5px;
                 border-style: solid;
                 border-color: black transparent transparent transparent;
                 }

             /* Show the tooltip text when you mouse over the tooltip container */
             .tooltip:hover .tooltip-text {
                 visibility: visible;
                 }

             @page iframe {size: portrait !important;}
`);
    // Handle Tampermonkey running the script too late to catch the loading events
    if (document.readyState != 'complete') {
        window.addEventListener('load', windowLoadedCallback);
    } else {
        windowLoadedCallback();
    }
    // Determine region
    const urlRegion = window.location.href.indexOf('trans-logistics-eu') > 0 ? '-eu' : '';

    function windowLoadedCallback() {
        // Override JsBarcode with a Chrome-compatible version
        // NOTE: Content Security Policy blocks the fetch (not an Amazon domain), causing some console spam, but it still works for some reason.
        var script = document.createElement('script');
        script.type = "text/javascript";
        fetch('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/barcodes/JsBarcode.code128.min.js')
            .then(response => response.text())
            .then(txt => {script.innerHTML = txt; document.getElementsByTagName('head')[0].appendChild(script);});
        // Tap into ajax requests
        $.ajaxSetup({
            dataFilter: function(data, type) {
                let newStr = data.replace('@page {size: landscape}', '@page {size: auto}')
                .replace('http://media-services.integ.amazon.com:8888/images/G/01/TransCentral/images/transportation/logo_amazon_fulfillment.jpg', 'https://drive-render.corp.amazon.com/view/bjerkt@/Tools%20-%20Mine/Userscripts/res/logo_amazon_fulfillment.jpg');
                // Move the Hazmat qr code to the first page
                const matches = [...newStr.matchAll(/(of the DOT.+?n)(.+?noted.+?tr>)(.+?)(<img.+?png.+?")( width.+?height.+?px.+?").+?(<p.+?p>).+?(<p.+?pdf.+?p>).+?\/tr>/g)][0];
                if (matches) {
                    const fixedStr = matches[1]+"<br>"+matches[4]+' width=\\"70px\\" height=\\"70px\\">'+matches[6]+matches[7]+matches[2];
                    newStr = newStr.replace(matches[0], fixedStr);
                }
                return newStr;
            }
        })
        const observer = new MutationObserver(elemChangeCallback);
        const obsConfig = { attributes: true, attributeFilter:["class"], attributeOldValue: true };
        const targetNode = document.getElementById('block-ui-container');
        observer.observe(targetNode, obsConfig);
        addBulkSearchButton();
        // Set up mutation observer to watch when refresh dialog is shown & cleared
        function elemChangeCallback (mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.target.classList.contains('hidden') && mutation.oldValue == '') {
                    addLinksTooltips();
                }
            }
        }
    }

    ///////////////////////////////////////////////////////////////////

    async function addLinksTooltips() {
        const vridContainers = document.querySelectorAll('td.loadIdCol');
        var facility = "MXP6";
        let carrierMap = {};
        let driverPlateMap = {};
        let driverIdMap = {};
        let VRIDOperationTypeMap = {};
        let vridList = [];
        ///////////////////////
        // Add links
        ///////////////////////
        for (let container of vridContainers) {
            const vrid = container.innerText.slice(0,9);
            vridList.push(vrid);
            // Don't make a double
            if (container.querySelector('a') === null) {
                addLinks(container, vrid, facility);
            }
        }
        ///////////////////////
        // Add tooltips
        ///////////////////////
        if(vridList.length > 0) {
            addSealTooltips();
            [carrierMap, driverPlateMap, driverIdMap, VRIDOperationTypeMap] = await getFMCData(vridList);
            const driverIconSpans = document.querySelectorAll('table#dashboard > tbody > tr > td.loadIdCol > span.driverPresent');
            const carrierElems = document.querySelectorAll('.loadIdCol + td + td');
            const loadIdElems = document.querySelectorAll('td.loadIdCol > span.loadId');
            requestAnimationFrame(() => {
                // Operation Type
                for (let elem of loadIdElems) {
                    if (VRIDOperationTypeMap[elem.textContent]) {
                        elem.classList.add('tooltip');
                        const tooltip = document.createElement('SPAN');
                        tooltip.classList.add('tooltip-text', 'optype-tooltip-text');
                        tooltip.innerHTML = VRIDOperationTypeMap[elem.textContent]
                        elem.appendChild(tooltip);
                    }
                }
                // Driver plates
                for (let theSpan of driverIconSpans) {
                    if (theSpan.children.length == 0) {
                        theSpan.removeAttribute('title');
                        theSpan.classList.add('tooltip', 'icon-driver');
                        const tooltip = document.createElement('SPAN');
                        tooltip.classList.add('tooltip-text', 'driver-tooltip-text');
                        tooltip.innerHTML = driverPlateMap[theSpan.previousElementSibling.innerText];
                        theSpan.appendChild(tooltip);
                    }
                }
                // Carrier names
                for (let elem of carrierElems) {
                    if (elem.children.length == 1) {
                        const idWrapper = document.createElement('SPAN');
                        idWrapper.classList.add('tooltip', 'icon-carrier');
                        const carrierIdNode = elem.childNodes[0];
                        carrierIdNode.textContent = carrierIdNode.textContent.slice(0,-1);
                        const tooltip = document.createElement('SPAN');
                        tooltip.classList.add('tooltip-text', 'carrier-tooltip-text');
                        tooltip.innerHTML = carrierMap[carrierIdNode.textContent.split('/')[0].trim()];
                        idWrapper.appendChild(carrierIdNode);
                        idWrapper.appendChild(tooltip);
                        elem.insertBefore(idWrapper, elem.children[0]);

                        // Phone numbers
                        const driverId = driverIdMap[elem.previousElementSibling.previousElementSibling.firstElementChild.innerText];
                        if (driverId) {
                            const phoneWrapper = document.createElement('SPAN');
                            phoneWrapper.classList.add('tooltip', 'icon-phone', 'icon-phone-pointer');
                            phoneWrapper.title = 'Get phone number from FMC';
                            phoneWrapper.addEventListener('click', function(e) {
                                e.stopPropagation();
                                createDriverPhoneTooltip(e.target, carrierIdNode.textContent.split('/')[0].trim(), driverId);
                                phoneWrapper.title = '';
                            }, {once: true});
                            elem.insertBefore(phoneWrapper, elem.children[1]);
                        }
                    }
                }
            });
        }
    }
    async function addSealTooltips() {
        try {
            let sealNums = {};
            const nodeSelectorOptions = document.getElementById('availableNodeName').options
            const nodeId = nodeSelectorOptions[nodeSelectorOptions.selectedIndex].text;
            // At very beginning of page load, date picker is blank. Use default. If not, overwrite with date range.
            let postData = {
                entity: 'getDefaultOutboundDockView',
                nodeId: nodeId
            };
            let dayStart = $("input[name\x3dfromDate]").val()
            if (dayStart != '') {
                let dayEnd = $("input[name\x3dtoDate]").val()
                , timeStart = $('#searchPanelTable [dataname\x3d"fromTime"] option:selected').val()
                , timeEnd = $('#searchPanelTable [dataname\x3d"toTime"] option:selected').val();
                if ("" != timeStart) {
                    var p = timeStart.split("-");
                    timeStart = p[0] + ":" + p[1];
                }
                else {
                    timeStart = "00:00";
                }
                "" != timeEnd ? (p = timeEnd.split("-"),
                                 timeEnd = p[0] + ":" + p[1]) : timeEnd = "00:00";
                let dateStart = new Date(dayStart + " " + timeStart + ":00 GMT")
                , startEpoch = dateStart.getTime()
                , dateEnd = new Date(dayEnd + " " + timeEnd + ":00 GMT")
                , endEpoch = dateEnd.getTime();
                postData = {
                    entity: 'getOutboundDockView',
                    nodeId: nodeId,
                    startDate: startEpoch,
                    endDate: endEpoch,
                    loadCategories: 'outboundScheduled,outboundInProgress,outboundReadyToDepart,outboundDeparted,outboundCancelled',
                    shippingPurposeType: 'TRANSSHIPMENT,NON-TRANSSHIPMENT'
                }
            }
            const response = await jQuery.ajax({
                url: 'https://www.amazonlogistics.eu/ssp/dock/hrz/ob/fetchdata',
                type: 'POST',
                data: postData,
                dataType: 'json'
            });
            for (let elem of response.ret.aaData) {
                if(elem.load.sealId) {
                    sealNums[elem.load.planId] = elem.load.sealId;
                }
            }
            const sealCheckSpans = document.querySelectorAll('table#dashboard > tbody > tr > td.trailerNumCol > span.sealIndicator');
            requestAnimationFrame(function() {
                for (let theSpan of sealCheckSpans) {
                    if (theSpan.children.length == 0) {
                        theSpan.removeAttribute('title');
                        theSpan.classList.add('tooltip', 'icon-seal');
                        const tooltip = document.createElement('SPAN');
                        tooltip.classList.add('tooltip-text', 'seal-tooltip-text');
                        tooltip.innerHTML = sealNums[theSpan.parentElement.parentElement.id];
                        theSpan.appendChild(tooltip);
                    }
                }
            });
        } catch(e) {
            console.group('SSP Util');
            console.log('Error getting seals from SSP:');
            console.error(e);
            console.groupEnd();}
    }
    async function getFMCData(vridList) {
        try {
            let vridListString = "";
            // Create query string
            for (let str of vridList) {
                const tmp = '"' + str + '",'
                vridListString += tmp;
            }
            // Chop off last comma
            vridListString = vridListString.slice(0,-1);
            let retCarrierMap = {};
            let retDriverPlateMap = {};
            let retDriverIdMap = {};
            let retVRIDOperationTypeMap = {};
            const postUrl = 'https://www.amazonlogistics.eu/fmc/search/execution/by-id';
            const postData = {
                "searchIds": vridList,
                "page": 0,
                "pageSize": 100,
                "bookmarkedSavedSearch": false,
                "executionViewModePreference": "vrs",
                "dashboardPreferences": "{\"length\":100,\"order\":[[12,\"asc\"]],\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true},\"columns\":[{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":false,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}}],\"childTable\":{\"hiddenColumns\":[\"estimatedArrival\",\"estimatedDelay\"],\"shownColumns\":[]},\"columnNames\":[{\"name\":\"collapsed_state\",\"index\":0},{\"name\":\"tour_id\",\"index\":1},{\"name\":\"vr_id\",\"index\":2},{\"name\":\"vr_map\",\"index\":3},{\"name\":\"vr_status\",\"index\":4},{\"name\":\"comments\",\"index\":5},{\"name\":\"tp_id\",\"index\":6},{\"name\":\"tp_actions\",\"index\":7},{\"name\":\"facility_sequence\",\"index\":8},{\"name\":\"disruptions\",\"index\":9},{\"name\":\"first_dock_arrival_time\",\"index\":10},{\"name\":\"first_yard_arrival_time\",\"index\":11},{\"name\":\"first_dock_departure_time\",\"index\":12},{\"name\":\"first_yard_departure_time\",\"index\":13},{\"name\":\"final_dock_arrival_time\",\"index\":14},{\"name\":\"final_yard_arrival_time\",\"index\":15},{\"name\":\"cpt\",\"index\":16},{\"name\":\"alerts\",\"index\":17},{\"name\":\"carrier_group\",\"index\":18},{\"name\":\"carrier\",\"index\":19},{\"name\":\"subcarrier\",\"index\":20},{\"name\":\"cr_id\",\"index\":21},{\"name\":\"shipper_accounts\",\"index\":22},{\"name\":\"equipment_type\",\"index\":23},{\"name\":\"client_contract\",\"index\":24},{\"name\":\"vr_tendering\",\"index\":25},{\"name\":\"tender_status\",\"index\":26},{\"name\":\"operator_id\",\"index\":27},{\"name\":\"driver\",\"index\":28},{\"name\":\"cases\",\"index\":29}]}",
                "originalCriteria": "{\"searchIds\":[" + vridListString + "],\"pageSize\":100}"
            };
            const response = await jQuery.ajax({
                url: postUrl,
                type: 'POST',
                data: JSON.stringify(postData),
                contentType: 'application/json',
                processData: false,
                dataType: 'json'
            });
            for (let record of response.returnedObject.records) {
                // debugger;
                console.log(record.vehicleRunId, record);
                retVRIDOperationTypeMap[record.vehicleRunId] = record.shipperAccounts[0];
                retCarrierMap[record.carrierId] = record.carrierName;
                // Also have choice of plan id, tour id...
                // stop 0 is pickup, asset 1 is tractor (0 trailer, 2 driver) !!Box truck, etc breaks this!
                // let tractorIndex = 1;
                //if (record.aggregatedStops[0].assets[0].category != 'LOADABLE') {
                //     tractorIndex = 0;
                // }
                let tractorAsset = {};
                for (let asset of record.aggregatedStops[0].assets) {
                    if (asset.category == "ENGINE") {
                        tractorAsset = asset;
                        break;
                    }
                }
                retDriverPlateMap[record.vehicleRunId] = tractorAsset.assetId;
                if (record.assignedDrivers[0]) {
                    retDriverIdMap[record.vehicleRunId] = record.assignedDrivers[0].assetId;
                }
            }
            return [retCarrierMap, retDriverPlateMap, retDriverIdMap, retVRIDOperationTypeMap];
        } catch(e) {
            console.group('SSP Util');
            console.log('Error getting data from FMC:');
            console.error(e);
            console.groupEnd();
        }
    }

    async function addLinks(container, vrid, facility) {
        // Add FMC link
        const a = document.createElement('a');
        const linkText = document.createTextNode("FMC");
        a.appendChild(linkText);
        a.title = "Open VRID in FMC";
        a.href = "https://www.amazonlogistics.eu/fmc/execution/search/" + vrid;
        a.target = "_blank";
        a.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(a);

        //Add TT link
        const b = document.createElement('a');
        const ttLink = document.createTextNode("TT");
        b.appendChild(ttLink);
        b.title = "Open VRID in TT";
        b.href = "https://www.amazonlogistics.eu/sortcenter/tantei?nodeId=MXP6&searchId=" + vrid;
        b.target = "_blank";
        b.style.marginLeft = "5px";
        b.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(b);

        // Add event report link
        const c = document.createElement('a');
        const erLink = document.createTextNode('ER');
        c.appendChild(erLink);
        c.title = "Open VRID in Event Report";
        c.href = "https://www.amazonlogistics.eu/yms/eventHistory#/eventReport?yard=MXP6&loadIdentifier=" + vrid;
        c.target = "_blank";
        c.style.marginLeft = "5px";
        c.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(c);

        // Add paragon link
        const d = document.createElement('a');
        const paLink = document.createTextNode('PA');
        d.appendChild(paLink);
        d.title = "Open VRID in Paragon";
        d.href = "https://paragon-eu.amazon.com/hz/search?searchQuery=" + vrid;
        d.target = "_blank";
        d.style.marginLeft = "5px";
        d.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(d);

        // Add ACES Target
        const wt = document.createElement('a');
        const wtc = document.createTextNode('WT');
        wt.addEventListener("click", function() {
            acesTarget(vrid);
        })
        wt.appendChild(wtc);
        wt.title = "Calculate ACES Target";
        wt.style.marginLeft = "5px";
        wt.style.fontSize = "11px";
        wt.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(wt);

        // Add ubication API
        const f = document.createElement('a');
        const dc = document.createTextNode('📍');
        f.appendChild(dc);
        f.title = "Open VRID in FMC Map";
        f.href = "https://www.amazonlogistics.eu/fmc/map?loadId=" + vrid;
        f.target = "_blank";
        f.style.marginLeft = "5px";
        f.style.fontSize = "11px";
        f.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(f);

        // Add pause loading
        const g = document.createElement('a');
        const gc = document.createTextNode('⏸️');
        g.addEventListener("click", function() {
            pauseLoading(vrid)
        });
        g.appendChild(gc);
        g.title = "Pause Loading";
        g.style.marginLeft = "5px";
        g.style.fontSize = "11px";
        g.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(g);

        // Add start detatch attach
        const sda = document.createElement('a');
        const sdac = document.createTextNode('⏯️');
        sda.addEventListener("click", function() {
            detachAttach(vrid);
        })
        sda.appendChild(sdac);
        sda.title = "Detach Attach Trailer";
        sda.style.marginLeft = "5px";
        sda.style.fontSize = "11px";
        sda.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        container.appendChild(sda);
        // Add loaded volume
        const locLabel = container.previousElementSibling.querySelector('.locLabel');
        if (locLabel && locLabel.previousSibling && locLabel.previousSibling.classList.contains("DOCK_DOOR")) {
            const url = 'http://wigo-eu-dub.dub.proxy.amazon.com/wigo/dock/signage/dockdoor?nodeId=' + facility + '&dockDoor=' + locLabel.innerHTML + '&orient=portrait';
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    const parser = new DOMParser();
                    const htmlDoc = parser.parseFromString(response.responseText, 'text/html');
                    const volumeElement = htmlDoc.querySelector('.volume');
                    let volumeValue = volumeElement ? volumeElement.textContent : 'Element not found';
                    const startIndex = volumeValue.indexOf('Vol');
                    const endIndex = volumeValue.indexOf('m3') + 2;
                    volumeValue = volumeValue.substring(startIndex, endIndex);
                    const volBox = document.createElement("div");
                    volBox.style.padding = "5px";
                    volBox.style.marginLeft = "10px";
                    const volText = document.createElement("span");
                    volText.className = "wigo-volume";
                    volText.textContent = volumeValue;
                    volBox.appendChild(volText);

                    locLabel.parentNode.insertBefore(volBox, locLabel.nextSibling);
                },
                onerror: function(response) {
                    console.error(response);
                }
            });
        }
    }

    async function createDriverPhoneTooltip(node, scac, driverId) {
        // Pop up tooltip with spinny placeholder
        const tooltip = document.createElement('SPAN');
        tooltip.classList.add('tooltip-text', 'driver-phone-tooltip-text');
        tooltip.innerHTML = '<span class="a-spinner a-spinner-small"></span>';
        node.appendChild(tooltip);
        // Get driver number
        try {
            const response = await jQuery.ajax({
                url: 'https://www.amazonlogistics.eu/fmc/driver/detail/'+scac+'/'+driverId,
                type: 'GET',
            });
            const name = response.returnedObject.name;
            const phoneNum = response.returnedObject.phone;
            console.log(response.returnedObject);
            tooltip.innerHTML = name + " / " + phoneNum;
            node.classList.remove('icon-phone-pointer');
        } catch (e) {
            console.error(e);
        }
    }

    async function addBulkSearchButton() {
        const topPane = document.getElementById('topPaneContent');
        const searchPane = document.createElement('DIV');
        searchPane.classList.add('search-pane');
        const searchDesc = document.createElement('SPAN');
        searchDesc.innerHTML = 'Search all selected VRIDs on FMC:';
        const searchBtn = document.createElement('BUTTON');
        searchBtn.classList.add('search-btn');
        searchBtn.addEventListener('click', searchSelectedVrids);
        searchBtn.innerHTML = 'Search';
        searchPane.appendChild(searchDesc);
        searchPane.appendChild(searchBtn);
        topPane.appendChild(searchPane);
        async function searchSelectedVrids() {
            const selectedVridRows = document.querySelectorAll('tr.selectedTableRow');
            // Push list of vrids to FMC, get bulk search url
            let vridList = [];
            let vridListString = '';
            if(selectedVridRows.length) {
                searchBtn.innerHTML = '<span class="a-spinner a-spinner-small"></span>';
                for (let tableRow of selectedVridRows) {
                    const vrid = tableRow.children[7].firstElementChild.innerText;
                    vridList.push(vrid);
                    vridListString += '"' + vrid + '",';
                }
                // Cut off last comma
                vridListString = vridListString.slice(0,-1);
                // Go!
                const postUrl = 'https://www.amazonlogistics.eu/fmc/search/execution/by-id';
                const postData = {
                    "searchIds": vridList,
                    "page": 0,
                    "pageSize": 100,
                    "bookmarkedSavedSearch": false,
                    "executionViewModePreference": "vrs",
                    "dashboardPreferences": "{\"length\":100,\"order\":[[12,\"asc\"]],\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true},\"columns\":[{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":false,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":false,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}},{\"visible\":true,\"search\":{\"search\":\"\",\"smart\":true,\"regex\":false,\"caseInsensitive\":true}}],\"childTable\":{\"hiddenColumns\":[\"estimatedArrival\",\"estimatedDelay\"],\"shownColumns\":[]},\"columnNames\":[{\"name\":\"collapsed_state\",\"index\":0},{\"name\":\"tour_id\",\"index\":1},{\"name\":\"vr_id\",\"index\":2},{\"name\":\"vr_map\",\"index\":3},{\"name\":\"vr_status\",\"index\":4},{\"name\":\"comments\",\"index\":5},{\"name\":\"tp_id\",\"index\":6},{\"name\":\"tp_actions\",\"index\":7},{\"name\":\"facility_sequence\",\"index\":8},{\"name\":\"disruptions\",\"index\":9},{\"name\":\"first_dock_arrival_time\",\"index\":10},{\"name\":\"first_yard_arrival_time\",\"index\":11},{\"name\":\"first_dock_departure_time\",\"index\":12},{\"name\":\"first_yard_departure_time\",\"index\":13},{\"name\":\"final_dock_arrival_time\",\"index\":14},{\"name\":\"final_yard_arrival_time\",\"index\":15},{\"name\":\"cpt\",\"index\":16},{\"name\":\"alerts\",\"index\":17},{\"name\":\"carrier_group\",\"index\":18},{\"name\":\"carrier\",\"index\":19},{\"name\":\"subcarrier\",\"index\":20},{\"name\":\"cr_id\",\"index\":21},{\"name\":\"shipper_accounts\",\"index\":22},{\"name\":\"equipment_type\",\"index\":23},{\"name\":\"client_contract\",\"index\":24},{\"name\":\"vr_tendering\",\"index\":25},{\"name\":\"tender_status\",\"index\":26},{\"name\":\"operator_id\",\"index\":27},{\"name\":\"driver\",\"index\":28},{\"name\":\"cases\",\"index\":29}]}",
                    "originalCriteria": "{\"searchIds\":[" + vridListString + "],\"pageSize\":100}"
                };
                try {
                    const response = await jQuery.ajax({
                        url: postUrl,
                        type: 'POST',
                        data: JSON.stringify(postData),
                        contentType: 'application/json',
                        processData: false,
                        dataType: 'json'
                    });
                    searchBtn.innerHTML = 'Search';
                    window.open('https://www.amazonlogistics.eu/'+response.suggestedUrl,'_blank')
                } catch(e) {
                    console.error(e);
                }
            }
        }
    }

    function pauseLoading(vrid) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.amazonlogistics.eu/sortcenter/tantei",
            onload: function (response) {
                const placeholder = document.createElement('div');
                placeholder.innerHTML = response.responseText;
                var token = placeholder.querySelector("input").value;
                let poster =
                    {"query":"\nquery ($queryInput: [SearchTermInput!]!) {\n  searchEntities(searchTerms: $queryInput) {\n    searchTerm {\n      nodeId\n      nodeTimezone\n      searchId\n      searchIdType\n      resolvedIdType\n    }\n    summary {\n      ... on ContainerSummary {\n        allInstancesContainerIds\n        containerId\n        containerType\n        containerLabel\n        parentContainerId\n        parentContainerLabel\n        parentContainerType\n        childrenCountDetails {\n          childrenCount\n          hasMoreChildren\n        }\n        criticalPullTime\n        stackingFilter\n        contentAuditState\n        shipmentId\n        hasDeparted\n        isClosed\n        forceDepartAllowed\n        \n        isAdhoc\n        isSortable\n        vehicleRunId\n        trailerNumber\n        attachedLoadId\n        associationScans {\n          firstScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n          lastScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n        }\n      }\n      ... on LoadSummary {\n        loadId\n        vehicleRunId\n        attachedTrailerId\n        carrier\n        lane\n        scheduledArrivalTime\n        actualArrivalTime\n        scheduledDepartureTime\n        actualDepartureTime\n        criticalPullTime\n        loadStatus\n        sealId\n        businessType\n      }\n    }\n  }\n}\n",
                     "variables":{"queryInput":[]}}
                poster.variables.queryInput.push({"nodeId": "MXP6", "searchId" : vrid, "searchIdType" : "UNKNOWN"});
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://www.amazonlogistics.eu/sortcenter/tantei/graphql",
                    data: JSON.stringify(poster),
                    headers: {
                        "Accept" :"*/*",
                        "anti-csrftoken-a2z" :	token,
                        "content-type" : "application/json"
                    },
                    onload: function (response) {
                        var obj = [];
                        let data = response.responseText;
                        data = ( typeof data === 'object' ) ? data : JSON.parse(data);
                        var lst = data.data.searchEntities;
                        for (var k=0; k<lst.length; k++) {
                            if(!!lst[k].summary) {
                                var loadId = lst[k].summary.loadId;
                                const result = window.confirm('Sei sicuro?');
                                if (result) {
                                    GM_xmlhttpRequest({
                                        method: "GET",
                                        url: "https://www.amazonlogistics.eu/ssp/dock/hrz/ob/fetchdata?entity=setLoadStatusLoadingPaused&nodeId=MXP6&planId=" + loadId + "&vrId=" + vrid,
                                        onload: function(response) {}
                                    });
                                    setTimeout(function() {
                                        document.querySelector("#manualRefresh").click();
                                    }, 1000);
                                };
                            }
                        };
                    }
                });
            }
        });
    }

    function detachAttach(vrid) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.amazonlogistics.eu/sortcenter/tantei",
            onload: function (response) {
                const placeholder = document.createElement('div');
                placeholder.innerHTML = response.responseText;
                var token = placeholder.querySelector("input").value;
                let poster =
                    {"query":"\nquery ($queryInput: [SearchTermInput!]!) {\n  searchEntities(searchTerms: $queryInput) {\n    searchTerm {\n      nodeId\n      nodeTimezone\n      searchId\n      searchIdType\n      resolvedIdType\n    }\n    summary {\n      ... on ContainerSummary {\n        allInstancesContainerIds\n        containerId\n        containerType\n        containerLabel\n        parentContainerId\n        parentContainerLabel\n        parentContainerType\n        childrenCountDetails {\n          childrenCount\n          hasMoreChildren\n        }\n        criticalPullTime\n        stackingFilter\n        contentAuditState\n        shipmentId\n        hasDeparted\n        isClosed\n        forceDepartAllowed\n        \n        isAdhoc\n        isSortable\n        vehicleRunId\n        trailerNumber\n        attachedLoadId\n        associationScans {\n          firstScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n          lastScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n        }\n      }\n      ... on LoadSummary {\n        loadId\n        vehicleRunId\n        attachedTrailerId\n        carrier\n        lane\n        scheduledArrivalTime\n        actualArrivalTime\n        scheduledDepartureTime\n        actualDepartureTime\n        criticalPullTime\n        loadStatus\n        sealId\n        businessType\n      }\n    }\n  }\n}\n",
                     "variables":{"queryInput":[]}}
                poster.variables.queryInput.push({"nodeId": "MXP6", "searchId" : vrid, "searchIdType" : "UNKNOWN"});
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://www.amazonlogistics.eu/sortcenter/tantei/graphql",
                    data: JSON.stringify(poster),
                    headers: {
                        "Accept" :"*/*",
                        "anti-csrftoken-a2z" :	token,
                        "content-type" : "application/json"
                    },
                    onload: function (response) {
                        var obj = [];
                        let data = response.responseText;
                        data = ( typeof data === 'object' ) ? data : JSON.parse(data);
                        var lst = data.data.searchEntities;
                        for (var k=0; k<lst.length; k++) {
                            if(!!lst[k].summary) {
                                var loadId = lst[k].summary.loadId;
                                var trailerId = lst[k].summary.attachedTrailerId;
                                const result = window.confirm('Sei sicuro?');
                                if (result) {
                                    GM_xmlhttpRequest({
                                        method: "GET",
                                        url: "https://www.amazonlogistics.eu/fetchdata?entity=detachLoadFromTrailer&nodeId=MXP6&planId=" + loadId + "&trailerId=" + trailerId + "&vrId=" + vrid,
                                        onload: function(response) {
                                            setTimeout(function() {
                                                GM_xmlhttpRequest({
                                                    method: "GET",
                                                    url: "https://www.amazonlogistics.eu/ssp/dock/hrz/ob/fetchdata?entity=attachLoadToTrailer&nodeId=MXP6&planId=" + loadId + "&trailerId="+ trailerId + "&resourceType=DOCK_DOOR&domesticLoadAttachFrictionOverridden=false",
                                                    onload: function(response) {
                                                        setTimeout(function() {
                                                            document.querySelector("#manualRefresh").click();
                                                        }, 200);
                                                    }
                                                });
                                            }, 1000);
                                        }
                                    });
                                }
                            };
                        };
                    }
                });
            }
        });
    }

    function acesTarget(vrid) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.amazonlogistics.eu/sortcenter/tantei",
            onload: function (response) {
                const placeholder = document.createElement('div');
                placeholder.innerHTML = response.responseText;
                var token = placeholder.querySelector("input").value;
                let poster =
                    {"query":"\nquery ($queryInput: [SearchTermInput!]!) {\n  searchEntities(searchTerms: $queryInput) {\n    searchTerm {\n      nodeId\n      nodeTimezone\n      searchId\n      searchIdType\n      resolvedIdType\n    }\n    summary {\n      ... on ContainerSummary {\n        allInstancesContainerIds\n        containerId\n        containerType\n        containerLabel\n        parentContainerId\n        parentContainerLabel\n        parentContainerType\n        childrenCountDetails {\n          childrenCount\n          hasMoreChildren\n        }\n        criticalPullTime\n        stackingFilter\n        contentAuditState\n        shipmentId\n        hasDeparted\n        isClosed\n        forceDepartAllowed\n        \n        isAdhoc\n        isSortable\n        vehicleRunId\n        trailerNumber\n        attachedLoadId\n        associationScans {\n          firstScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n          lastScan {\n            eventTime\n            eventDescription {\n              associationReason\n              childContainerId\n              childContainerLabel\n              parentContainerId\n              parentContainerLabel\n              parentContainerType\n            }\n          }\n        }\n      }\n      ... on LoadSummary {\n        loadId\n        vehicleRunId\n        attachedTrailerId\n        carrier\n        lane\n        scheduledArrivalTime\n        actualArrivalTime\n        scheduledDepartureTime\n        actualDepartureTime\n        criticalPullTime\n        loadStatus\n        sealId\n        businessType\n      }\n    }\n  }\n}\n",
                     "variables":{"queryInput":[]}}
                poster.variables.queryInput.push({"nodeId": "MXP6", "searchId" : vrid, "searchIdType" : "UNKNOWN"});
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://www.amazonlogistics.eu/sortcenter/tantei/graphql",
                    data: JSON.stringify(poster),
                    headers: {
                        "Accept" :"*/*",
                        "anti-csrftoken-a2z" :	token,
                        "content-type" : "application/json"
                    },
                    onload: function (response) {
                        var obj = [];
                        let data = response.responseText;
                        data = ( typeof data === 'object' ) ? data : JSON.parse(data);
                        var lst = data.data.searchEntities;
                        for (var k=0; k<lst.length; k++) {
                            if(!!lst[k].summary) {
                                var loadId = lst[k].summary.loadId;
                                var trailerId = lst[k].summary.attachedTrailerId;
                                GM_xmlhttpRequest({
                                    method: "GET",
                                    url: "https://www.amazonlogistics.eu/ssp/dock/hrz/ob/fetchdata?entity=getOutboundLoadContainerDetails&nodeId=MXP6&planId=" + loadId + "&vrId=" + vrid + "&status=&trailerId=" + trailerId + "&trailerNumber=",
                                    responseType: 'json',
                                    onload: function(response) {
                                        const json = response.response;
                                        let containers = {};

                                        if (typeof json.ret.aaData.ROOT_NODE !== "undefined") {
                                            if (json.ret.aaData.ROOT_NODE[0].container.contType === "TRAILER") {
                                                for (let n = 0; n < json.ret.aaData.ROOT_NODE[0].childNodes.length; n++) {
                                                    const containerNode = json.ret.aaData.ROOT_NODE[0].childNodes[n].container;
                                                    const contType = containerNode.contType;

                                                    if (contType === "CART" || contType === "GAYLORD" || contType === "PALLET") {
                                                        const label = containerNode.label;
                                                        const stackFilter = containerNode.stackFilter;
                                                        containers[label] = [contType, stackFilter];
                                                    }
                                                }
                                            } else {
                                                for (let n = 0; n < json.ret.aaData.ROOT_NODE.length; n++) {
                                                    const containerNode = json.ret.aaData.ROOT_NODE[n].container;
                                                    const contType = containerNode.contType;

                                                    if (contType === "CART" || contType === "GAYLORD" || contType === "PALLET") {
                                                        const label = containerNode.label;
                                                        const stackFilter = containerNode.stackFilter;
                                                        containers[label] = [contType, stackFilter];
                                                    }
                                                }
                                            }

                                            let target = 0;
                                            for (const label in containers) {
                                                const [contType, stackFilter] = containers[label];

                                                switch (contType) { // Tutti i valori sono x10000 per evitare il float
                                                    case "CART":
                                                        if (stackFilter.endsWith("F-VCRI")) {
                                                            target += 8024;
                                                        } else if (stackFilter.endsWith("BAG")) {
                                                            target += 8024;
                                                        } else if (stackFilter.endsWith("ALL")) {
                                                            target += 11832;
                                                        } else {
                                                            target += 11832;
                                                        }
                                                        break;

                                                    case "GAYLORD":
                                                    case "PALLET":
                                                        if (stackFilter.endsWith("F-VCRI")) {
                                                            target += 9222;
                                                        } else if (stackFilter.endsWith("BAG")) {
                                                            target += 9222;
                                                        } else if (stackFilter.endsWith("ALL")) {
                                                            target += 12879;
                                                        } else {
                                                            target += 12879;
                                                        }
                                                        break;
                                                }
                                            }

                                            alert("ACES Target = " + (target / 10000).toFixed(1) + "mÂ³");
                                        } else {
                                            console.log(vrid + " is empty");
                                        }
                                    }
                                });
                            };
                        };
                    }
                });
            }
        });
    }
})();

(function() {
    'use strict';

    var _vsmDict = {};

    window.onload = function() {
        addExpandAllButton();
        getSTEM();
        containerCountButton();
    }

    function getSTEM() {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.amazonlogistics.eu/sortcenter/equipmentmanagement/node/MXP6/equipment",
            onload: function (response) {
                const placeholder = document.createElement('div');
                placeholder.innerHTML = response.responseText;
                var token = placeholder.querySelector("input").value;
                var epoch = Date.now() - 1000;
                let poster = [{"operationName":"VisualSortationMarkers","variables":{"nodeId":"MXP6","asOfTime":"" + epoch + ""},"query":"query VisualSortationMarkers($nodeId: String!, $asOfTime: String!) {\n  visualSortationMarkers(nodeId: $nodeId, asOfTime: $asOfTime) {\n    visualMarkers {\n      visualMarker\n    }\n    stackingFilter\n  }\n}\n"}]
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://www.amazonlogistics.eu/sortcenter/equipmentmanagement/graphql",
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

    function expandFirst(e) {
        e.stopPropagation();
        var tableContainer = document.getElementById("tbl_containerID");
        var expanders = document.getElementsByClassName("show-child");

        for (let i = 0; i < expanders.length; i++) {
            if (expanders[i].classList.length == 1) {
                expanders[i].click();
            }
        }
    }

    function expandAll(e) {
        e.stopPropagation();
        var tableContainer = document.getElementById("tbl_containerID");
        var expanders = document.getElementsByClassName("show-child");

        for (let i = 0; i < expanders.length; i++) {
            if (!expanders[i].classList.contains("collapsedChild")) {
                expanders[i].click();
            }
        }
    }

    function closeAll(e) {
        e.stopPropagation();
        var tableContainer = document.getElementById("tbl_containerID");
        var expanders = document.getElementsByClassName("show-child");

        for (let i = 0; i < expanders.length; i++) {
            if (expanders[i].classList.contains("collapsedChild")) {
                expanders[i].click();
            }
        }
    }

    function addExpandAllButton() {
        let expandFirstButton = document.getElementById("expand-first-button");
        let expandAllButton = document.getElementById("expand-all-button");
        let closeAllButton = document.getElementById("close-all-button");
        if (typeof(expandFirstButton) == "undefined" || expandFirstButton == null || typeof(expandAllButton) == "undefined" || expandAllButton == null || typeof(closeAllButton) == "undefined" || closeAllButton == null) {

            let tableContainer = document.getElementById("tbl_containerID");
            let firstElement = tableContainer.firstChild;

            expandFirstButton = document.createElement("button");
            expandFirstButton.type = "button";
            expandFirstButton.id = "expand-first-button";
            expandFirstButton.innerHTML = "<b>Expand First</b>";
            expandFirstButton.addEventListener("click", function(e) {expandFirst(e)});
            tableContainer.append(expandFirstButton);

            expandAllButton = document.createElement("button");
            expandAllButton.type = "button";
            expandAllButton.id = "expand-all-button";
            expandAllButton.innerHTML = "<b>Expand All</b>";
            expandAllButton.addEventListener("click", function(e) {expandAll(e)});
            tableContainer.append(expandAllButton);

            closeAllButton = document.createElement("button");
            closeAllButton.type = "button";
            closeAllButton.id = "close-all-button";
            closeAllButton.innerHTML = "<b>Close All</b>";
            closeAllButton.addEventListener("click", function(e) {closeAll(e)});
            tableContainer.append(closeAllButton);

            tableContainer.append(firstElement);
        }
    }

    function containerCountButton() {
        var existingButton = document.getElementById('expand-all-button');
        if (!existingButton) {
            console.error('Could not find existing button with ID "expand-all-button". Aborting script.');
            return;
        }

        var newButton = document.createElement('button');
        newButton.innerHTML = '<b>Count Containers</b>';
        newButton.style.marginLeft = '5px';

        existingButton.parentNode.insertBefore(newButton, existingButton.nextSibling);

        newButton.addEventListener('click', function() {
            var elements = document.querySelectorAll('.contType.ColContType, .conType.ColContType ');
            var filteredElements = Array.from(elements).filter(function(element) {
                var textContent = element.textContent.trim();
                return textContent === 'CART' || textContent === 'GAYLORD' || textContent === 'PALLET';
            });
            var count = filteredElements.length;
            alert('Container: ' + count);
        });
    }

    document.addEventListener("keydown", function(e) {
        if (((e.which || e.keyCode) == 116) || ((e.which || e.keyCode)) == 192) {
            e.preventDefault();

            let smallHeight = 0;
            let scrollTop = document.documentElement.scrollTop;
            console.log(document.documentElement.scrollTop);
            console.log(document.documentElement.scrollHeight);
            setTimeout(function() {
                smallHeight = document.documentElement.scrollHeight;
            }, 50);

            const setScrollTop = function() {
                if (document.documentElement.scrollHeight == smallHeight) {
                    setTimeout(setScrollTop, 20);
                    return;
                }
                document.documentElement.scrollTop = scrollTop;
            }

            setTimeout(setScrollTop, 100);

            localStorage.setItem("sspScrollTop", document.documentElement.scrollTop);
            document.querySelector("#manualRefresh").click();
        }
    });
})();

window.addEventListener ("load", function () {
    waitForKeyElements ("table.dataTable.display tbody tr", colorText);
}, false);

function colorText (jNode) {
    jNode.has ('td:contains("Scheduled")').css("color", "#505050")
    jNode.has ('td:contains("ATSEU")').css("color", "#1CA8E3").css("font-style", "italic")
    jNode.has ('td:contains("Finished")').css("color", "#00BB00")
    jNode.has ('td:contains("Completed")').css("color", "#00AAAA")
    jNode.has ('td:contains("Attached")').css("color", "#CC00CC")
    jNode.has ('td:contains("Ready For")').css("color", "#FF9900")
    jNode.has ('td:contains("Progress")').css("color", "#5050DD")
    jNode.has ('td:contains("Paused")').css("color", "#AA0000")
    jNode.has ('td:contains("Cancelled")').css("color", "#FF0000").css("font-weight", "bold")
    jNode.has ('td:contains("RLB1")').css("color", "#FF0000").css("font-weight", "bold")
    jNode.has ('td:contains("AZNG")').css("color", "#FF0000").css("font-weight", "bold")
    return; }

function waitForKeyElements (
selectorTxt,    /* Required: The jQuery selector string that
                        specifies the desired element(s).
                    */
 actionFunction, /* Required: The code to run when elements are
                        found. It is passed a jNode to the matched
                        element.
                    */
 bWaitOnce,      /* Optional: If false, will continue to scan for
                        new elements even after the first match is
                        found.
                    */
 iframeSelector  /* Optional: If set, identifies the iframe to
                        search.
                    */
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined")
        targetNodes     = $(selectorTxt);
    else
        targetNodes     = $(iframeSelector).contents ()
            .find (selectorTxt);

    if (targetNodes  &&  targetNodes.length > 0) {
        btargetsFound   = true;
        /*--- Found target node(s).  Go through each and act if they
            are new.
        */
        targetNodes.each ( function () {
            var jThis        = $(this);
            var alreadyFound = jThis.data ('alreadyFound')  ||  false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound     = actionFunction (jThis);
                if (cancelFound)
                    btargetsFound   = false;
                else
                    jThis.data ('alreadyFound', true);
            }
        } );
    }
    else {
        btargetsFound   = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj      = waitForKeyElements.controlObj  ||  {};
    var controlKey      = selectorTxt.replace (/[^\w]/g, "_");
    var timeControl     = controlObj [controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound  &&  bWaitOnce  &&  timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval (timeControl);
        delete controlObj [controlKey]
    }
    else {
        //--- Set a timer, if needed.
        if ( ! timeControl) {
            timeControl = setInterval ( function () {
                waitForKeyElements (    selectorTxt,
                                    actionFunction,
                                    bWaitOnce,
                                    iframeSelector
                                   );
            },
                                       300
                                      );
            controlObj [controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj   = controlObj;
};

(function() {

    function replaceElementAndBoldButton() {
        const initialHTML = `<!-- <div class="floatL">
              <a title="Toggle andon view" class="switchAndon"  href="javascript:void(0);"><input type="button" value="Switch"></a>
         </div> -->`;

        const finalHTML = `<div class="floatL">
              <a title="Toggle andon view" class="switchAndon"  href="javascript:void(0);"><input type="button" value="Switch"></a>
         </div>`;

        // Find and replace the initial HTML with the final one
        const bodyContent = document.body.innerHTML;
        const replacedContent = bodyContent.replace(initialHTML, finalHTML);

        // Update the document with the replaced content
        document.body.innerHTML = replacedContent;

        // Find the button with the value "Switch" and make its text bold
        const buttons = document.getElementsByTagName('input');
        for (const button of buttons) {
            if (button.value === 'Switch') {
                button.style.fontWeight = 'bold';
            }
        }

        // After replacing the elements and making the button bold, run the observer for progress divs
        observeProgressDivs();
    }

    function observeProgressDivs() {
        // Observe changes in the DOM to detect when the progress divs appear
        const observer = new MutationObserver(function(mutationsList) {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    removeStyleFromProgressDivs();
                }
            }
        });

        // Start observing the body for changes (subtree) to detect the appearance of progress divs
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function removeStyleFromProgressDivs() {
        // Find and remove the style tag from div elements whose class starts with "progressbarDashboard progressCell"
        const divElements1 = document.querySelectorAll('div[class^="progressbarDashboard progressCell"]');
        for (const div1 of divElements1) {
            div1.removeAttribute('style');
        }
        const divElements2 = document.querySelectorAll('div[class^="progressbarDashboard progressbarDashboardBorder progressCell"]');
        for (const div2 of divElements2) {
            div2.removeAttribute('style');
        }
    }

    // Immediately run the replaceElementAndBoldButton function
    //setTimeout(replaceElementAndBoldButton, 2000);
})();

(function() {
    'use strict';
    GM_addStyle(`
.ccs-error-box-centered {
 position: relative;
 left: 50%;
 top: 50%;
 transform: translate(-50%, -50%);
 background-color:#FFD;
 border:2px solid #A31919;
 border-radius:8px 8px 8px 8px;
 clear:both;
 display:inherit;
 margin:8px;
 max-height:100px;
 overflow:auto;
 text-align: center;
}
`)

    // Handle Tampermonkey running the script too late to catch the loading events
    if (document.readyState != 'complete') {
        window.addEventListener('load', windowLoadedCallback);
    } else {
        windowLoadedCallback();
    }
    // Determine region
    const urlRegion = window.location.href.indexOf('trans-logistics-eu') > 0 ? '-eu' : '';

    function windowLoadedCallback() {
        const observer = new MutationObserver(elemChangeCallback);
        const obsConfig = { attributes: true, attributeFilter:["class"], attributeOldValue: true };
        const targetNode = document.getElementById('resourceAvailable');
        observer.observe(targetNode, obsConfig);
        // Set up mutation observer to watch when refresh dialog is shown & cleared
        function elemChangeCallback (mutationsList, observer) {
            console.log("mutation occurred");
            for (let mutation of mutationsList) {
                console.log(mutation.target);
                const selectedVrid = document.querySelectorAll('tr.selectedTableRow');
                const selectedVridDriverPresent = selectedVrid[0].cells[7].children[1];

                //Checks for moveguardAlert and deletes it if it exists
                const containerDivExists = document.getElementById('moveguardContainer');
                console.log(containerDivExists);
                if (containerDivExists) {
                    console.log("Exists");
                    console.log(containerDivExists);
                    containerDivExists.remove();
                }

                if (selectedVridDriverPresent.classList.contains("driverPresent")){
                    createAlert('DRIVER IS PRESENT','Please verify with TOM before sending move',true,true);
                }
            }
        }

        //This is a catch all function to enable easy expansion of options
        function createAlert(alertContent,warningContent,hasAlert,hasWarning){
            var element = document.getElementById("resourceAvailableDiv");

            var containerDiv = document.createElement("div");
            containerDiv.setAttribute('id', 'moveguardContainer');

            element.prepend(containerDiv);
            if(hasAlert){
                //Checks for moveguardAlert and deletes it if it exists
                const alertDivExists = document.getElementById('moveguardAlert');
                if (alertDivExists) {
                    console.log("Exists");
                    console.log(alertDivExists);
                    element.removeChild(alertDivExists);
                }
                //This scramble generates a container and text element containing the fed text for the ALERT
                var alertDiv = document.createElement("div");
                alertDiv.classList.add("ccs-error-box-centered");
                alertDiv.style.fontSize = "20px"
                alertDiv.style.fontWeight = "bold"
                //makes finding the alert easier later for removal
                alertDiv.setAttribute('id', 'moveguardAlert');
                var alertTextHead = document.createTextNode(alertContent);
                alertDiv.appendChild(alertTextHead);

                //adds alertDiv to our Element
                //element.prepend(alertDiv);
                containerDiv.appendChild(alertDiv);
            }
            //begin warningspace
            if (hasWarning){
                //Checks for moveguardAlert and deletes it if it exists
                const warningDivExists = document.getElementById('moveguardWarning');
                if (warningDivExists) {
                    console.log("Exists");
                    console.log(warningDivExists);
                    element.removeChild(warningDivExists);
                }
                //This scramble generates a container and text element containing the fed text for the ALERT
                var warningDiv = document.createElement("div");
                warningDiv.classList.add("ccs-error-box-centered");
                warningDiv.style.fontSize = "12px"
                warningDiv.style.fontStyle = "italic"
                //makes finding the alert easier later for removal
                warningDiv.setAttribute('id', 'moveguardWarning');
                var warningTextHead = document.createTextNode(warningContent);
                warningDiv.appendChild(warningTextHead);

                //adds alertDiv to our Element
                //element.prepend(warningDiv);
                containerDiv.appendChild(warningDiv);
            }
        }

    }
})();
