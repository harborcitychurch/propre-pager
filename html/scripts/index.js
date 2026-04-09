window.onload = function() {
    form = document.getElementById('pager_form');
    form.addEventListener('submit', e => submitPage(e));
    form.elements.room.addEventListener('change', () => updateRecents(true));

    warning_container = document.getElementById('connection_status_container');
    warning_container.innerHTML = WARNING_ICON_SVG + warning_container.innerHTML;

    updateRooms().then(() => {
        updateRecents(true);
        setInterval(updateRecents, 9000);
    });
    setInterval(checkServer, 20000);
}

WARNING_ICON_SVG = `<svg fill="#FF0000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="800px" height="800px" viewBox="0 0 478.125 478.125"
     xml:space="preserve">
<g>
    <g>
        <g>
            <circle cx="239.904" cy="314.721" r="35.878"/>
            <path d="M256.657,127.525h-31.9c-10.557,0-19.125,8.645-19.125,19.125v101.975c0,10.48,8.645,19.125,19.125,19.125h31.9
                c10.48,0,19.125-8.645,19.125-19.125V146.65C275.782,136.17,267.138,127.525,256.657,127.525z"/>
            <path d="M239.062,0C106.947,0,0,106.947,0,239.062s106.947,239.062,239.062,239.062c132.115,0,239.062-106.947,239.062-239.062
                S371.178,0,239.062,0z M239.292,409.734c-94.171,0-170.595-76.348-170.595-170.596c0-94.248,76.347-170.595,170.595-170.595
                s170.595,76.347,170.595,170.595C409.887,333.387,333.464,409.734,239.292,409.734z"/>
        </g>
    </g>
</g>
</svg>`;

recentPages = [];
recentsVersion = null;
recentsSince = null;
pagerClientId = null;

function parseServerUtcTimestamp(timestamp) {
    return new Date(timestamp.replace(' ', 'T') + 'Z');
}

//recall room index from local storage
function recallRoom() {
    var room = localStorage.getItem('room');
    if (room) {
        document.getElementById('room').value = room;
    }
}

//store room index in local storage
function storeRoom() {
    var room = document.getElementById('room').value;
    var storedRoom = localStorage.getItem('room');
    if (room === storedRoom) {
        return;
    }
    localStorage.setItem('room', room);
}

function updateRooms() {
    return fetch('/api/rooms')
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
            recallRoom();
        });
}

function checkServer() {
    statusIcon = document.getElementById('connection_status_container');
    try {
        var params = new URLSearchParams();
        params.set('role', 'pager');
        if (pagerClientId) {
            params.set('client_id', pagerClientId);
        }

        fetch(`/api/ping?${params.toString()}`, { cache: 'no-store' })
            .then(response => {
                var clientId = response.headers.get('X-Client-Id');
                if (clientId) {
                    pagerClientId = clientId;
                }
                if (response.status === 204) {
                    statusIcon.className = 'status-ok';
                    return;
                }
                throw new Error('Server not responding');
            })
            .catch(error => {
                statusIcon.className = 'status-error';
                console.error(error);
            });
    }
    catch (error) {
        statusIcon.className = 'status-error';
        console.error(error);
    }

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
        let color = 'green';
        if (response.status === 200) {
            form.elements.child_number.value = '';
            storeRoom();
        }
        else {
            color = 'red';
        }
        return { text: response.text(), color: color };
    })
    .then(data => {
        data.text.then(message => toast(message, data.color));
    });
}

function updateRecents(forceFull=false) {
    var recentsContainer = document.getElementById('recents_container');
    var table = document.getElementById('recents');

    // ask api for pages, including cache hint parameters.
    var params = new URLSearchParams();
    params.set('minutes', '30');
    params.set('room', document.getElementById('room').value);
    if (forceFull) {
        params.set('full', '1');
    }
    if (!forceFull && recentsVersion !== null) {
        params.set('version', recentsVersion);
    }
    if (!forceFull && recentsSince !== null) {
        params.set('since', recentsSince);
    }

    var endpoint = `/api/recents?${params.toString()}`;
    fetch(endpoint)
        .then(response => {
            var responseVersion = response.headers.get('X-Recents-Version');
            var responseUpdatedAt = response.headers.get('X-Recents-Updated-At-Ms');

            if (responseVersion !== null) {
                recentsVersion = parseInt(responseVersion);
            }
            if (responseUpdatedAt !== null) {
                recentsSince = parseInt(responseUpdatedAt);
            }

            if (response.status === 304) {
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data === null) {
                return;
            }

            if (!Array.isArray(data)) {
                if (data.version !== undefined) {
                    recentsVersion = data.version;
                }
                if (data.updated_at_ms !== undefined) {
                    recentsSince = data.updated_at_ms;
                }

                if (data.changed === false) {
                    return;
                }

                recentPages = data.items || [];
            }
            else {
                recentPages = data;
            }

            recentPages = recentPages.sort((a, b) => parseServerUtcTimestamp(b.timestamp) - parseServerUtcTimestamp(a.timestamp));

            //clear the table except for the header row
            while (table.rows.length > 1) {
                table.deleteRow(1);
            }

            if (recentPages.length > 0) {
                recentsContainer.classList.add('visible');
            }
            else {
                recentsContainer.classList.remove('visible');
            }
            //add rows to the table
            recentPages.forEach(page => {
                var row = table.insertRow();
                row.id = page.key;
                var cell1 = row.insertCell(0);
                var cell2 = row.insertCell(1);
                var cell3 = row.insertCell(2);
                var cell4 = row.insertCell(3);
                cell1.textContent = page.child_number;
                cell2.textContent = page.room;
                cell3.textContent = parseServerUtcTimestamp(page.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                var dot = document.createElement('span');
                dot.className = 'status-dot status-' + page.status;
                dot.title = page.status;
                cell4.appendChild(dot);
                cell4.appendChild(document.createTextNode(' ' + page.status));
            });
        });
}
