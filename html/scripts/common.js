function toast(message, color="green") {
    var toast = document.getElementById("toast");
    var toastMessage = document.getElementById("toast-message");
    toast.style.backgroundColor = color;
    toastMessage.textContent = message;
    toast.className = "toast show";
    setTimeout(function() { toast.className = "toast"; }, 3000);
}