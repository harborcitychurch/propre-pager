window.onload = function () {
    updateTime();
    setInterval(updateTime, 1000);
}

document.addEventListener("DOMContentLoaded", function(event) {
    document.querySelectorAll('img').forEach(function(img){
       img.onerror = function(){this.style.display='none';};
    })
 });

function toast(message, color="green") {
    var toast = document.getElementById("toast");
    var toastMessage = document.getElementById("toast-message");
    toast.style.backgroundColor = color;
    toastMessage.textContent = message;
    toast.className = "toast show";
    setTimeout(function() { toast.className = "toast"; }, 3000);
}

function updateTime() {
    var clock = document.getElementById("clock");
    var now = new Date();
    clock.textContent = now.toLocaleString();
}