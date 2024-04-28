window.onload = function() {
    updateRooms();
    form = document.getElementById('pager_form');
    form.addEventListener('submit', e => submitPage(e));

    warning_container = document.getElementById('connection_status_container');
    warning_container.innerHTML = WARNING_ICON_SVG + warning_container.innerHTML;

    setInterval(checkServer, 5000);
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
            recallRoom();
        });
}

function checkServer() {
    statusIcon = document.getElementById('connection_status_container');
    try {
        fetch('/api/now')
            .then(response => {
                if (response.status === 200) {
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

