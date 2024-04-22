window.onload = function() {
    updateRooms();
    form = document.getElementById('pager_form');
    form.addEventListener('submit', e => submitPage(e));
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
            storeRoom();
        }
        return response.text();
    })
    .then(data => {
        toast(data);
    });
}

