//control.js
//User constants
MAX_PAGES = 3; //maximum number of pages to display at once
TABLE_UPDATE_INTERVAL = 200; //time in milliseconds to update the tables
AUTO_PAGE_INTERVAL = 1000; //time in milliseconds to switch to the next page
DISPLAY_TIME = 20000; //time in milliseconds to display the page on the screen


//initailize the page when everything is loaded
window.onload = function () {
    document.getElementById("propresenter_address").addEventListener("change", checkAlive);
    document.getElementById("propresenter_port").addEventListener("change", checkAlive);
    form = document.getElementById('pager_form');
    form.addEventListener('submit', e => submitPage(e));
    recallProPresenterAddress();
    updateRooms();
    getNewPages();
    checkAlive();

    autoPageTimer = document.getElementById("auto_page_interval").value * 1000;

    //set intervals for updating the time and checking for new pages
    setInterval(autoPageProcess, AUTO_PAGE_INTERVAL);
    setInterval(checkAlive, 3000);
    setInterval(getNewPages, 2000);
    setInterval(updateTables, TABLE_UPDATE_INTERVAL);
}

var pageBucket = {};
var autoPageHandler = [];
var autoPage = false;
var connectedToProPresenter = false;
var connectedToServer = true;
var autoPageTimer = 0
var lastSent;

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
                var minutes = Math.floor(time / 60);
                var seconds = time % 60;
                let t = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
                if (t && t != "0:00") {
                    return t;
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
        var light = document.getElementById("auto_page_indicator");
        light.className = "on";
        nextPage();
        setTimeout(() => {light.className = "off";}, 250);
    }
}

function nextPage() {
    var interval = document.getElementById("auto_page_interval").value * 1000;

    //check each id in autoPageHandler to see if they are expired and purge them
    for (var i = 0; i < autoPageHandler.length; i++) {
        if (pageBucket[autoPageHandler[i]].isExpired() || 
        pageBucket[autoPageHandler[i]].status === "cancelled" || 
        pageBucket[autoPageHandler[i]].status === "expired") {
            autoPageHandler.splice(i, 1);
        }
    }
    
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
            updateStatus(addPage, "auto");
            autoPageHandler.push(addPage);
        }
    }

    if (autoPageTimer <= 0 && autoPageHandler.length > 0) {
        autoPageTimer = interval;
        var next = autoPageHandler.shift();
        //don't send the same page twice in a row if there are other pages in the queue
        if (next == lastSent && autoPageHandler.length > 1) {
            autoPageHandler.push(next);
            next = autoPageHandler.shift();
        }
        //if the last page is not expired, set it back to auto to wait for the next cycle
        if (pageBucket[lastSent] && pageBucket[lastSent].status === "active") {
            updateStatus(lastSent, "auto");
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
    var propresenterAddress = document.getElementById("propresenter_address").value +
        ':' + document.getElementById("propresenter_port").value;
    if (!propresenterAddress) {
        setConnectionStatus();
        return;
    }
    var url = 'http://' + propresenterAddress + '/version';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                response.address = propresenterAddress;
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
    var activePagesTable = document.getElementById("active_pages");
    var pagerListTable = document.getElementById("pager_list");
    var expiredCancelledTable = document.getElementById("prev_pages");

    // Clear the tables
    while (activePagesTable.rows.length > 1) {
        activePagesTable.deleteRow(1);
    }
    while (pagerListTable.rows.length > 1) {
        pagerListTable.deleteRow(1);
    }
    while (expiredCancelledTable.rows.length > 1) {
        expiredCancelledTable.deleteRow(1);
    }

    for (var id in pageBucket) {
        p = pageBucket[id];

        if (p.status === "queued") {
            var age = Math.floor((Date.now() - Date.parse(p.timestamp + 'Z')) / 60000);
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + p.child_number + '</td>' +
                '<td>' + p.room + '</td>' +
                '<td>' + age + '</td>' +
                '<td><div class="page_buttons"><button onclick="sendToProPresenter(this)">Send</button>' +
                '<button class="delete_button" onclick="warnDelete(this)">' + TRASH_CAN_SVG + '</button>' +
                '</div></td>';
            row.id = id;
            pagerListTable.appendChild(row);
        }

        if (p.status === "active" || p.status === "auto") {
            var time;
            var percent;

            if (p.isExpired() && p.status === "active") {
                time = "expired";
                updateStatus(id, "expired");
                console.log(id + " is expired.")
            }

            time = p.countdown();
            percent = Math.floor((p.duration / DISPLAY_TIME) * 100);

            var row = document.createElement('tr');
            if (time !== "expired" && time !== "-" && p.status === "active") {
                active = "active";
            }
            else {
                active = "";
            }
            var row = document.createElement('tr');
            row.innerHTML = '<td class="' + active + '">' + p.child_number + '</td>' +
                '<td class="' + active + '">' + p.room + '</td>' +
                '<td class="' + active + '">' + time + '</td>' +
                '<td width="50px"><div class="progress-bar" style="width: ' + percent + '%;"></div></td>' +
                '<button class="delete_button" onclick="warnDelete(this)">' + 
                TRASH_CAN_SVG + '</button>';
            row.id = id;
            activePagesTable.appendChild(row);
        }

        if (p.status === "expired" || p.status === "cancelled") {
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
            //insert after the header row
            expiredCancelledTable.insertBefore(row, expiredCancelledTable.children[1]);
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
        updateStatus(row.id, "cancelled");
    }
}

function getNewPages() {
    var url = '/api/list';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            var pages = JSON.parse(xhr.responseText);
            //add new pages to the pageBucket
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
    }
    xhr.send();
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

    var page = pageBucket[id];

    var propresenterAddress = document.getElementById("propresenter_address").value + ':' + document.getElementById("propresenter_port").value;
    var url = 'http://' + propresenterAddress + '/v1/message/parent-pager/trigger';
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
                    updateStatus(id, "active");
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

function updateStatus(id, status) {
    pageBucket[id].status = status;
    var url = '/api/report'
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    jsonstring = '{ "key": "' + id + '", "status": "' + status + '" }';
    xhr.send(jsonstring);
}