//control.js
//User constants
MAX_PAGES = 3; //maximum number of pages to display at once
TABLE_UPDATE_INTERVAL = 200; //time in milliseconds to update the tables
AUTO_PAGE_INTERVAL = 1000; //time in milliseconds to update the auto pager
DISPLAY_TIME = 20000; //time in milliseconds to display the page on the screen

//Global variables
var pageBucket = {};
var autoPageHandler = [];
var autoPage = false;
var connectedToProPresenter = false;
var connectedToServer = true;
var autoPageTimer = 0
var lastSent;

//initailize the page when everything is loaded
window.onload = function () {
    document.getElementById("propresenter_address").addEventListener("change", checkAlive);
    document.getElementById("propresenter_port").addEventListener("change", checkAlive);
    form = document.getElementById('pager_form');
    form.addEventListener('submit', e => submitPage(e));
    document.getElementById("propresenter_message_name").addEventListener("change", saveMessageName)
    document.getElementById("health_status").addEventListener('pointerover', showStatusText);
    document.getElementById("health_status").addEventListener('pointerout', hideStatusText);
    recallProPresenterAddress();
    updateRooms();
    getNewPages();
    checkAlive();

    //clock follows the page when scrolling
    window.addEventListener('scroll', function() {
        var clock = document.getElementById('clock');
        if (window.scrollY > 120) {
            clock.style.position = 'fixed';
            clock.style.top = '0'; //height of the header when scrolled down
        } else {
            clock.style.position = 'absolute';
            clock.style.top = '120px'; //height of the header
        }
    });

    message_uuid = document.getElementById("propresenter_message_uuid");
    message_name = document.getElementById("propresenter_message_name").value;
    window.addEventListener('change', function() {
        if (message_name) {
            message_uuid.textContent = document.querySelector(`option[value="${message_name}"]`).dataset.uuid || "00000000-0000-0000-0000-000000000000";
        }
    });

    autoPageTimer = document.getElementById("auto_page_interval").value * 1000;

    //set intervals for updating the time and checking for new pages
    setInterval(autoPageProcess, AUTO_PAGE_INTERVAL);
    setInterval(checkAlive, 3000);
    setInterval(getNewPages, 2000);
    setInterval(updateTables, TABLE_UPDATE_INTERVAL);
    setInterval(updateMessageList, 10000);
}

//page object
// timestamp: time the page was created
// child_number: the child's number
// room: the room the child is in
// expires: the time the page expires

class Page {
    constructor(id, child_number, room, status = "queued", duration = 10000) {
        this.id = id
        this.timestamp = Date.now();
        this.child_number = child_number;
        this.room = room;
        this.expires = false;
        this.status = status;
        this.duration = duration;
    }

    status() {
        return this.status;
    }

    id() {
        return this.id;
    }

    countdown() {
        if (this.status === "active" || this.status === "auto" && this.duration > 0) {
            if (this.duration > 0) {
                var time = Math.floor(this.duration / 1000);
                if (time && time >= 1) {
                    return time;
                }
                else {
                    return "-"; 
                }
            }
        }
        else {
            return "-";
        }
    }

    isExpired() {
        if (this.expires && this.duration < 1) {
            return true;
        }
        else {
            return false;
        }
    }
}

function showStatusText() {document.getElementById("host-server-status-text").className = "";}
function hideStatusText() {document.getElementById("host-server-status-text").className = "hidden";}

function saveMessageName() {
    var messageName = document.getElementById("propresenter_message_name").value;
    if (messageName) {
        localStorage.setItem("messageName", messageName);
    }
}

function updateRooms() {
    fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            const select = document.querySelector('select[name="room"]');
            select.innerHTML = '';
            data.forEach(room => {
                const option = document.createElement('option');
                option.value = room.name;
                option.textContent = room.name;
                select.appendChild(option);
            });
        });
}

function autoPageProcess() {
    if (autoPage) {
        cleanUpPageBuckets();
        var light = document.getElementById("auto_page_indicator");
        light.className = "on";
        nextPage();
        setTimeout(() => {light.className = "off";}, 250);
    }
}

function toggleSettings() {
    var expand = document.getElementById("expand_settings");
    if (expand.textContent === "add") {
        expand.textContent = "remove";
    }
    else {
        expand.textContent = "add";
    }
    var settings = document.getElementsByClassName("settings");
    for (var i = 0; i < settings.length; i++) {
        //add or remove the hidden class
        if (settings[i].classList.contains("hidden")) {
            settings[i].classList.remove("hidden");
        }
        else {
            settings[i].classList.add("hidden");
        }
    }

}

function nextPage() {
    var interval = document.getElementById("auto_page_interval").value * 1000;
    
    //fill the autoPageHandler with pages
    if (autoPageHandler.length < MAX_PAGES) {
        let addPage;
        for (var id in pageBucket) {
            let p = pageBucket[id];
            if (p.status === "auto" && !autoPageHandler.includes(id)) { 
                console.log("Found orphan auto page: " + id);
                addPage = id;
                break;
            }
            if (!addPage && p.status === "queued") { 
                addPage = id;
            }
        }
        if (addPage) { 
            pageBucket[addPage].duration = DISPLAY_TIME;
            pageBucket[addPage].expires = true;
            reportStatus(addPage, "auto");
            autoPageHandler.push(addPage);
        }
    }

    if (autoPageTimer <= 0 && autoPageHandler.length > 0) {
        autoPageTimer = interval;
        var next = autoPageHandler.shift();
        //don't send the same page twice in a row
        if (next == lastSent) {
            autoPageHandler.push(next);
            next = autoPageHandler.shift();
        }
        //if the last page is not expired, set it back to auto to wait for the next cycle
        if (pageBucket[lastSent] && pageBucket[lastSent].status === "active") {
            reportStatus(lastSent, "auto");
        }
        sendToProPresenter(next);
        autoPageHandler.push(next);
    }

    //this eliminates the delay for the first page if the queue is empty
    if (autoPageHandler.length == 0){
        autoPageTimer = 0;
    }
    else {
        autoPageTimer -= AUTO_PAGE_INTERVAL;
    }
}

function cleanUpPageBuckets() {
    //check each id in pageBucket to see if they are expired and set them to expired
    for (var id in pageBucket) {
        if (pageBucket[id].isExpired()) {
            reportStatus(id, "completed");
        }
    }

    //check each id in autoPageHandler to see if they are expired and purge them
    for (var i = 0; i < autoPageHandler.length; i++) {
        if (pageBucket[autoPageHandler[i]].isExpired() || 
        pageBucket[autoPageHandler[i]].status === "cancelled" || 
        pageBucket[autoPageHandler[i]].status === "expired" ||
        pageBucket[autoPageHandler[i]].status === "completed") {
            autoPageHandler.splice(i, 1);
        }
    }
}

function toggleAutoPage() {
    var autoPageButton = document.getElementById("auto_page_button");
    if (autoPageButton.textContent === "Auto Page: OFF") {
        autoPageButton.textContent = "Auto Page: ON";
        autoPageButton.className = "active";
        autoPage = true;
    }
    else {
        autoPageButton.textContent = "Auto Page: OFF";
        autoPageButton.className = "inactive";
        autoPage = false;
    }
}

function checkAlive() {
    let ppAddress = document.getElementById("propresenter_address").value;
    let ppPort = document.getElementById("propresenter_port").value;
    if (!ppAddress) {
        setConnectionStatus();
        return;
    }
    var url = `http://${ppAddress}:${ppPort}/version`;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 2000;
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                response.address = `${ppAddress}:${ppPort}`;
                reportAlive(response);
            }
            else {
                setConnectionStatus();
            }
        }
    }
    xhr.send();
}

function reportAlive(info) {
    //check stored address, and if different, update it
    var storedAddress = localStorage.getItem("propresenterAddress");
    if (storedAddress !== info.address) {
        localStorage.setItem("propresenterAddress", info.address);
    }
    localStorage.setItem("propresenterAddress", info.address);
    setConnectionStatus('Connected to ' + info.name + ' - ' + info.host_description);
    updateMessageList();
}

function setConnectionStatus(status = false) {
    var connectionStatus = document.getElementById("connection_status");
    if (status) {
        if (connectionStatus.textContent === status) {
            connectedToProPresenter = true;
            return;
        }
        if (connectionStatus.className === "offline") {
            toast("Connected to ProPresenter");
        }
        connectionStatus.textContent = status;
        connectionStatus.className = "online";
        connectedToProPresenter = true;
    }
    else {
        if (connectionStatus.className === "offline") {
            connectedToProPresenter = false;
            return;
        }
        connectionStatus.textContent = 'ProPresenter disconnected';
        connectionStatus.className = "offline";
        connectedToProPresenter = false;
    }
}

function storeProPresenterAddress() {
    var propresenterAddress = document.getElementById("propresenter_address").value + ':' + document.getElementById("propresenter_port").value;
    localStorage.setItem("propresenterAddress", propresenterAddress);
}

function recallProPresenterAddress() {
    var propresenterAddress = localStorage.getItem("propresenterAddress");
    var propresenterAddressField = document.getElementById("propresenter_address");
    var propresenterPortField = document.getElementById("propresenter_port");
    if (propresenterAddress) {
        propresenterAddressField.value = propresenterAddress.split(':')[0];
        propresenterPortField.value = propresenterAddress.split(':')[1];
    }
}

function checkVersion(address) {
    var url = 'http://' + address + '/version';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                console.log(xhr.responseText);
                var response = JSON.parse(xhr.responseText);
                return response;
            } else {
                return null;
            }
        }
    }
    xhr.send();
}

function updateTables() {
    var activePagesTable = document.querySelector("#active_pages > tbody");
    var pagerListTable = document.querySelector("#pager_list > tbody");
    var expiredCancelledTable = document.querySelector("#prev_pages > tbody");

    // Clear the tables
    while (activePagesTable.rows.length > 0) {
        activePagesTable.deleteRow(0);
    }
    while (pagerListTable.rows.length > 0) {
        pagerListTable.deleteRow(0);
    }
    while (expiredCancelledTable.rows.length > 0) {
        expiredCancelledTable.deleteRow(0);
    }

    for (var id in pageBucket) {
        p = pageBucket[id];

        if (p.status === "queued") {
            var age = Math.floor((Date.now() - Date.parse(p.timestamp + 'Z')) / 60000);
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + p.child_number + '</td>' +
                '<td>' + p.room + '</td>' +
                '<td>' + age + '</td>' +
                '<td><div class="page_buttons"><button onclick="sendToProPresenter(this)"><i class="material-icons">send</i></button>' +
                '<button class="delete_button" onclick="warnDelete(this)"><span class="material-icons">delete</span></button>' +
                '</div></td>';
            row.id = id;
            pagerListTable.appendChild(row);
        }

        if (p.status === "active" || p.status === "auto") {
            var time;
            var percent;

            if (p.isExpired() && p.status === "active") {
                time = "copmleted";
                reportStatus(id, "completed");
                console.log(id + " is completed.")
            }

            time = p.countdown();

            dec_percent = p.duration / DISPLAY_TIME;
            percent = Math.floor(dec_percent * 100);

            var row = document.createElement('tr');
            if (time !== "-" && p.status === "active") {
                active = "active";
            }
            else {
                active = "";
            }
            
            let cdtimer = `${time} <div class="progress-bar-container"><div class="progress-bar" style="width: ${percent}%"></div></div>`

            var row = document.createElement('tr');
            row.innerHTML = '<td class="' + active + '">' + p.child_number + '</td>' +
                '<td class="' + active + '">' + p.room + '</td>' +
                '<td class="' + active + '">' + cdtimer + '</td>' +
                '<td><div class="page_buttons"><button class="delete_button" onclick="warnDelete(this)">' + 
                '<span class="material-icons">delete<span></button></div></td>';
            row.id = id;
            activePagesTable.appendChild(row);
        }

        if (p.status === "expired" || p.status === "cancelled" || p.status === "completed") {
            var row = document.createElement('tr');
            var date = new Date(p.timestamp);
            var hours = date.getHours();
            if(date.getTimezoneOffset() != 0) {
                hours = (hours - date.getTimezoneOffset() / 60 + 24) % 24;
            }
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            var minutes = date.getMinutes();
            var formattedTime = (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + ampm;

            row.innerHTML = '<td>' + p.child_number + '</td>' +
            '<td>' + p.room + '</td>' +
            '<td>' + p.status + '</td>' +
            '<td>' + formattedTime + '</td>';
            row.id = p.id;
            //insert at the top of the previous pages table
            expiredCancelledTable.insertBefore(row, expiredCancelledTable.children[0]);
        }

        if (!p.isExpired() && p.duration > 0 && p.status === "active") {
            p.duration -= TABLE_UPDATE_INTERVAL;
        }
    }
}

function warnDelete(button) {
    var row = button.parentNode.parentNode.parentNode;
    var child_number = row.cells[0].textContent;
    var room = row.cells[1].textContent;
    var message = "Are you sure you want to delete the page for child " + child_number + " in room " + room + "?";
    if (confirm(message)) {
        reportStatus(row.id, "cancelled");
    }
}

function getNewPages() {
    var url = '/api/list';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            connectedToServer = true;
            indicator = document.getElementById("host-server-status");
            indicator.textContent = "check_circle";
            indicator.parentElement.className = "ok";
            msg = document.getElementById("host-server-status-text");
            msg.textContent = "Host server OK";

            var pages = JSON.parse(xhr.responseText);
            //add new pages to the pageBucket
            pageBucket = {};
            for (var i = 0; i < pages.length; i++) {
                if (pageBucket[pages[i].key]) { pageBucket[pages[i].key].status = pages[i].status; }
                else {
                    pageBucket[pages[i].key] = new Page(pages[i].key, pages[i].child_number, pages[i].room, pages[i].status);
                    pageBucket[pages[i].key].timestamp = pages[i].timestamp;
                    if (pageBucket[pages[i].key].status === "active" || pageBucket[pages[i].key].status === "auto") {
                        pageBucket[pages[i].key].duration = DISPLAY_TIME;
                        pageBucket[pages[i].key].expires = true;
                    }
                    var alert_sound = document.getElementById("notify_sound");
                    alert_sound.play();
                }
                
            }
        }
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status != 200) {
            connectedToServer = false;
            indicator = document.getElementById("host-server-status");
            indicator.textContent = "error";
            indicator.parentElement.className = "error";
            msg = document.getElementById("host-server-status-text");
            msg.textContent = "Host server OFFLINE";
        }
    }
    xhr.send();
}

function updateMessageList() {
    if (connectedToProPresenter) {
        var propresenter_address = document.getElementById("propresenter_address").value;
        var propresenter_port = document.getElementById("propresenter_port").value;
        var select = document.getElementById("propresenter_message_name");
        var url = `http://${propresenter_address}:${propresenter_port}/v1/messages`;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                var messages = JSON.parse(xhr.responseText);
                select.innerHTML = '';
                messages.forEach(function (message) {
                    var option = document.createElement("option");
                    option.value = message.id.name;
                    option.text = message.id.name;
                    option.dataset.uuid = message.id.uuid;
                    select.appendChild(option);
                });
               select.value = localStorage.getItem("messageName");
            }
        };
        xhr.send();
    }
}

function sendToProPresenter(id) {
    if (!connectedToProPresenter) {
        toast("Cannot send page, not connected to ProPresenter.", "red");
        return;
    }
    //if page is a button, get the row data
    if (typeof id === 'string') {}
    else if (id.tagName === "BUTTON") {
        _id = id.parentNode.parentNode.id;
        if (!_id) {
            _id = id.parentNode.parentNode.parentNode.id;
        }
        id = _id;
    }

    var pager_name = document.getElementById("propresenter_message_name").value;

    if (!pager_name) {
        toast("Unable to send page: Please select a message name in settings", "red");
        return;
    }

    var page = pageBucket[id];

    let ppAddress = document.getElementById("propresenter_address").value;
    let ppPort = document.getElementById("propresenter_port").value;
    var url = `http://${ppAddress}:${ppPort}/v1/message/${pager_name}/trigger`;
    var payload = [
        {
            "name": "Child#",
            "text": {
                "text": page.child_number
            }
        },
        {
            "name": "Room",
            "text": {
                "text": page.room
            }
        }
    ];

    console.log(payload);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    console.log("Sending page to ProPresenter: " + JSON.stringify(payload));
    xhr.send(JSON.stringify(payload));

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 204) {
                toast("Message sent to ProPresenter successfully.");
                if (page.status === "queued") {
                    page.duration = DISPLAY_TIME;
                    page.expires = true;
                }
                if (page.status != "active") {
                    reportStatus(id, "active");
                }
                lastSent = id;
            } else {
                toast("Error sending message to ProPresenter.", "red");
            }
        }
    };
}

function submitPage(e) {
    e.preventDefault();
    fetch('/api/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            child_number: form.elements.child_number.value,
            room: form.elements.room.value
        })
        
    })
    .then(response => {
        if (response.status === 200) {
            form.elements.child_number.value = '';
        }
        return response.text();
    })
    .then(data => {
        toast(data);
    });
}

function reportStatus(id, status) {
    pageBucket[id].status = status;
    var url = '/api/report'
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    jsonstring = '{ "key": "' + id + '", "status": "' + status + '" }';
    xhr.send(jsonstring);
}