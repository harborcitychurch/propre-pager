//control.js
//User constants
MAX_PAGES = 3; //maximum number of pages to display at once
PAGE_SWITCH_INTERVAL = 3000; //time in milliseconds to switch between pages
DISPLAY_TIME = 21000; //time in milliseconds to display the page on the screen

//initailize the page when everything is loaded
window.onload = function () {
    document.getElementById("propresenter_address").addEventListener("change", checkAlive);
    document.getElementById("propresenter_port").addEventListener("change", checkAlive);
    recallProPresenterAddress();
    getNewPages();
    checkAlive();

    //set intervals for updating the time and checking for new pages
    setInterval(autoPageProcess, PAGE_SWITCH_INTERVAL);
    setInterval(checkAlive, 3000);
    setInterval(getNewPages, 2000);
    setInterval(updateTables, 200);
}

var pageBucket = {};
var activePages = [];
var currentIndex = 0;
var autoPage = false;

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
        if (!this.expires) {
            return "-";
        }
        var time = Math.floor((this.expires - Date.now()) / 1000);
        if (time < 0) {
            return "expired";
        }
        else {
            return time;
        }
    }

    isExpired() {
        if (this.expires) {
            return Date.now() > this.expires;
        }
        else {
            return false;
        }
    }
}

function autoPageProcess() {
    if (autoPage) {
        var light = document.getElementById("auto_page_indicator");
        light.className = "on";
        pruneActivePages();
        fillActivePages();
        nextPage();
        light.className = "off";
    }
}

function pruneActivePages() {
    for (var i = 0; i < activePages.length; i++) {
        if (pageBucket[activePages[i]].duration <= 0) {
            activePages.splice(i, 1);
            pageBucket[activePages[i].id].status = "expired";
            reportStatus(activePages[i].id, "expired");
        }
    }
}

function fillActivePages() {
    while (activePages.length < MAX_PAGES) {
        for (var id in pageBucket) {
            if (pageBucket[id].status === "queued") {
                activePages.push(id);
                pageBucket[id].status = "active";
                pageBucket[id].duration = DISPLAY_TIME;
                reportStatus(id, "active");
            }
        }
    }
}

function nextPage() {
    prev = currentIndex;
    currentIndex++;
    if (currentIndex >= activePages.length) {
        currentIndex = 0;
    }

    //decrement the duration of the current page
    pageBucket[activePages[currentIndex]].duration -= PAGE_SWITCH_INTERVAL;

    //only send a new page if the page has changed
    if (prev !== currentIndex) {
        sendToProPresenter(activePages[currentIndex]);
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
            return;
        }
        if (connectionStatus.className === "offline") {
            toast("Connected to ProPresenter");
        }
        connectionStatus.textContent = status;
        connectionStatus.className = "online";
    }
    else {
        if (connectionStatus.className === "offline") {
            return;
        }
        connectionStatus.textContent = 'Server disconnected';
        connectionStatus.className = "offline";
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

    while (activePagesTable.rows.length > 1) {
        activePagesTable.deleteRow(1);
    }
    // Clear the tables, except the header
    while (pagerListTable.rows.length > 1) {
        pagerListTable.deleteRow(1);
    }

    for (var id in pageBucket) {
        p = pageBucket[id];
        if (p.status === "queued") {
            var age = Math.floor((Date.now() - Date.parse(p.timestamp + 'Z')) / 60000);
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + p.child_number + '</td>' +
                '<td>' + p.room + '</td>' +
                '<td>' + age + '</td>' +
                '<td><button onclick="sendToProPresenter(this)">Send</button></td>';
            row.id = id;
            pagerListTable.appendChild(row);
        }

        if (p.status === "active" || p.status === "expired") {
            if (p.status === "expired") {
                time = "-";
            }
            else {
                if (p.isExpired()) {
                    time = "expired";
                    reportStatus(id, "expired");
                    p.expires = false;
                    console.log(id + " is expired.")
                }
                else {
                    time = p.countdown();
                }
            }

            var row = document.createElement('tr');
            if (time !== "expired" && time !== "-") {
                active = "active";
            }
            else {
                active = "";
            }
            row.innerHTML = '<td class="' + active + '">' + p.child_number + '</td>' +
                '<td class="' + active + '">' + p.room + '</td>' +
                '<td class="' + active + '">' + time + '</td>' +
                '<td><button onclick="sendToProPresenter(this)">Re-send</button></td>';
            row.id = p.id;
            activePagesTable.appendChild(row);
        }
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
                }
            }
        }
    }
    xhr.send();
}

function sendToProPresenter(id) {
    //if page is a button, get the row data
    if (id.tagName === "BUTTON") {
        id = id.parentNode.parentNode.id;
        console.log(id);
    }

    var page = pageBucket[id];

    var propresenterAddress = document.getElementById("propresenter_address").value + ':' + document.getElementById("propresenter_port").value;
    var url = 'http://' + propresenterAddress + '/v1/message/CityKidsPager/trigger';
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
                reportStatus(id, "active");
                pageBucket[id].status = "active";
                pageBucket[id].expires = Date.now() + DISPLAY_TIME;
            } else {
                toast("Error sending message to ProPresenter.", "red");
            }
        }
    };
}

function reportStatus(id, status) {
    var url = '/api/report'
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    jsonstring = '{ "key": "' + id + '", "status": "' + status + '" }';
    xhr.send(jsonstring);
}