document.addEventListener("DOMContentLoaded", function(event) {
    document.querySelectorAll('img').forEach(function(img){
       img.onerror = function(){this.style.display='none';};
    })
    updateTime();
    setInterval(updateTime, 1000);
 });

 //SVG ICON DATA
 WARNING_ICON_SVG = `<svg fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
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
 TRASH_CAN_SVG = `<svg class="trashcan" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 25 24.8" style="enable-background:new 0 0 25 24.8;" xml:space="preserve" class="icon-trashcan ct-delete" data-ember-action="" data-ember-action-1015="1015">
 <g class="trashcan-open">
   <path d="M18.7,24.4H5.9L4.9,7h14.9L18.7,24.4z M7.6,22.6H17l0.8-13.7h-11L7.6,22.6z"></path>
   <polygon points="13.6,10.3 13.1,21.2 14.9,21.2 15.4,10.3 "></polygon>
   <polygon points="11.5,21.2 11,10.3 9.2,10.3 9.7,21.2 "></polygon>
   <path d="M19.1,0.7l-4.7,0.9l-0.8-1.4L8.2,1.3L8,3l-4.7,1l0.2,4.7l17.3-3.5L19.1,0.7z 
            
            M8.8,1.9l4.4 -1.0 l0.5,0.8
            L8.7,2.8z 
            
            M5.2,6.4l0-1L18,2.8l0.3,0.9L5.2,6.4z"></path>
 </g>
 <g class="trashcan-closed">
   <path d="M6.8,8.8h11L17,22.6
            H7.6L6.8,8.8z 
            M4.9,7l1,17.4h12.8
            l1-17.4
            H4.9z"></path>
   <polygon points="13.6,10.3 13.1,21.2 14.9,21.2 15.4,10.3 "></polygon>
   <polygon points="11.5,21.2 11,10.3 9.2,10.3 9.7,21.2 "></polygon>
   <path d="M20.4,4h-4.8l-0.5-1.6
            H9.5L9,4
            H4.2
            L3.5,8.6h17.6
            L20.4,4z 
            
            M9.9,3.2h4.8
            L14.9,3.9h-5.2z
            
            M5.6,6.7l0.2-1 h13l0.2,1
            H5.6z"></path>
 </g>
 </svg>`;

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