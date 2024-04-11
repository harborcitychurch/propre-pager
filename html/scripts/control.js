//control.js
//initailize the page when everything is loaded
window.onload = function() {
    document.getElementById("propresenter_address").addEventListener("change", checkAlive);
    recallProPresenterAddress();
    checkAndUpdatePagerList();
    updateTime();
    checkAlive();

    //set intervals
    setInterval(checkAndUpdatePagerList, 5000);
    setInterval(updateTime, 1000);
    setInterval(checkAlive, 2000);
}


function checkAlive() {
    var propresenterAddress = document.getElementById("propresenter_address").value;
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
    var propresenterAddress = document.getElementById("propresenter_address").value;
    localStorage.setItem("propresenterAddress", propresenterAddress);
}

function recallProPresenterAddress() {
    var propresenterAddress = localStorage.getItem("propresenterAddress");
    if (propresenterAddress) {
        document.getElementById("propresenter_address").value = propresenterAddress;
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

function checkAndUpdatePagerList() {
    var pagerListTable = document.querySelector('table[name="pager_list"]');
    var url = '/api/list';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            // Clear the table, except the header
            while (pagerListTable.rows.length > 1) {
                pagerListTable.deleteRow(1);
            }    
            var response = JSON.parse(xhr.responseText);
            // Sort the response by age, highest first
            response.sort(function(a, b) {
                var ageA = Math.floor((Date.now() - Date.parse(a.timestamp)) / 60000);
                var ageB = Math.floor((Date.now() - Date.parse(b.timestamp)) / 60000);
                return ageB - ageA;
            });
            for (var i = 0; i < response.length; i++) {
                var age = Math.floor((Date.now() - Date.parse(response[i].timestamp)) / 60000);
                var time = new Date(response[i].timestamp).toLocaleTimeString();
                var row = document.createElement('tr');
                row.innerHTML = '<td>' + response[i].child_number + '</td>' +
                                '<td>' + response[i].room + '</td>' +
                                '<td>' + age + '</td>' +
                                '<td><button onclick="sendToProPresenter(this)">Push</button></td>';
                pagerListTable.appendChild(row);
            }
            
        }
    };
    xhr.send();
}

function sendToProPresenter(button) {
    var row = button.parentNode.parentNode;
    var childNumber = row.getElementsByTagName("td")[0].innerText;
    var room = row.getElementsByTagName("td")[1].innerText;
    var propresenterAddress = document.getElementById("propresenter_address").value;

    var url = 'http://' + propresenterAddress + '/v1/message/CityKidsPager/trigger';
    var payload = [
            {
                "name": "Child#",
                "text": {
                    "text": childNumber
                }
            },
            {
                "name": "Room",
                "text": {
                    "text": room
                }
            }
        ];

    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(payload));

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 204) {
                toast("Message sent to ProPresenter successfully.");
                row.parentNode.removeChild(row);
            } else {
                toast("Error sending message to ProPresenter.", "red");
            }
        }
    };
}

function updateTime() {
    var clock = document.getElementById("clock");
    var now = new Date();
    clock.textContent = now.toLocaleString();
}