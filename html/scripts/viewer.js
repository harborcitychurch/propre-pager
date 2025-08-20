//viewer.js
TABLE_UPDATE_INTERVAL = 200; //.2 seconds
PAGE_STALE_TIME = 10 * 60 * 1000; //10 minutes
ALERT_FLASH_INTERVAL = 500; //500 milliseconds

//Global variables
var pageBucket = {};
var flash_alert = false;

//initailize the page when everything is loaded
window.onload = function () {
    document.getElementById("health_status").addEventListener('pointerover', showStatusText);
    document.getElementById("health_status").addEventListener('pointerout', hideStatusText);
    getNewPages();

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

    //set intervals for updating the time and checking for new pages
    setInterval(getNewPages, 2000);
    setInterval(updateTables, TABLE_UPDATE_INTERVAL);
    setInterval(checkAlert, ALERT_FLASH_INTERVAL);

    updateTables();
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
function checkAlert() { 
    af = document.getElementById("alert_frame");
    if (flash_alert && af.hidden) {
        af.hidden = false;
    }
    else {
        af.hidden = true;
    }
}

function cleanUpPageBuckets() {
    //check each id in pageBucket to see if they are expired and set them to expired
    for (var id in pageBucket) {
        if (pageBucket[id].isExpired()) {
            reportStatus(id, "expired");
        }
    }
}

//Test copied text: 987	Room 3	0	senddelete
// 2nd Test: Room 3 321      Room 2 229      Room 1 197      
function copyQueue() {
    let queue = document.getElementById('pager_list');
    let rows = queue.querySelectorAll('tr');
    //skip if there are no rows
    if (rows.length === 1) {
        toast("No pages to copy", 'orange');
        console.log("No pages to copy");
        return;
    }
    let text = '';
    let ids = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        console.log(cells);
        // Only select text from the 2nd and 1st td (room and child_number)
        if (cells.length < 2) return; // skip if not enough cells
        text += cells[1].textContent + ' ' + cells[0].textContent + '       ';
        ids.push(row.id);
    });
    navigator.clipboard.writeText(text).then(() => {
        console.log('Queue copied to clipboard');
    });
    for (let i = 0; i < ids.length; i++) {
        reportStatus(ids[i], "completed");
    }
    toast("Queue copied to clipboard", "success");
    getNewPages();
}

function updateTables() {
    var pagerListTable = document.querySelector("#pager_list > tbody");
    var expiredCancelledTable = document.querySelector("#prev_pages > tbody");

    // Clear the tables
    while (pagerListTable.rows.length > 0) {
        pagerListTable.deleteRow(0);
    }
    while (expiredCancelledTable.rows.length > 0) {
        expiredCancelledTable.deleteRow(0);
    }

    flash_alert = false; //reset flash alert

    for (var id in pageBucket) {
        p = pageBucket[id];

        var raw_age = (Date.now() - Date.parse(p.timestamp + 'Z'));
        if (p.status === 'queued' && raw_age > PAGE_STALE_TIME) {
            reportStatus(id, "expired");
            p.status = "expired";
            console.log(id + " is expired due to being stale.");
        }

        if (p.status === "queued") {
            var age = Math.floor((Date.now() - Date.parse(p.timestamp + 'Z')) / 60000);
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + p.child_number + '</td>' +
                '<td>' + p.room + '</td>' +
                '<td>' + age + '</td>' +
                '<td><div class="page_buttons"><button class="delete_button" onclick="warnDelete(this)">' +
                '<span class="material-icons">delete</span></button>' +
                '</div></td>';
            row.id = id;
            pagerListTable.appendChild(row);
            flash_alert = true; //set flash alert to true if there are queued pages
        }
        else {
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
            '<td>' + formattedTime + '</td>' +
            '<td><div class="page_buttons"><button onclick="copyRow(this)">' +
            '<span class="material-icons">content_copy</span></button>' +
            '</div></td>';
            row.id = p.id;
            //insert at the top of the previous pages table
            expiredCancelledTable.insertBefore(row, expiredCancelledTable.children[0]);
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

function copyRow(button) {
    var row = button.parentNode.parentNode.parentNode;
    var child_number = row.cells[0].textContent;
    var room = row.cells[1].textContent;
    navigator.clipboard.writeText(room + ' ' + child_number + '       ').then(() => {
        console.log('Row copied to clipboard');
        toast("Row copied to clipboard", "success");
    });
    //report the status as completed
    reportStatus(row.id, "completed");
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

function reportStatus(id, status) {
    pageBucket[id].status = status;
    var url = '/api/report'
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    jsonstring = '{ "key": "' + id + '", "status": "' + status + '" }';
    xhr.send(jsonstring);
}