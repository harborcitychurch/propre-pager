//propresenterapi.js

// This script is designed to be used with ProPresenter 7, API version 1

OK = 200;
OK_EMPTY = 204;
GET = 'GET';
POST = 'POST';
PUT = 'PUT';
DELETE = 'DELETE';

class ProPresenterAPI {
    API_PATH = '/api/v1/';

    constructor(address, port) {
        this.address = address;
        this.port = port;
    }

    #call(method, path, payload) {
        var req = new XMLHttpRequest();
        req.open(method, this.#endpoint(path), false);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(payload);
    
        if (req.status === OK) {
            return JSON.parse(req.responseText);
        } else if (req.status === OK_EMPTY) {
            return true;
        } else {
            return false;
        }
    }

    #endpoint() {
        address = 'http://' + this.address + ':' + this.port 
            + this.API_PATH + '/' + path;
        for (var i = 0; i < arguments.length; i++) {
            address += '/' + arguments[i];
        }
        return address;
    }

    checkAlive() {
        result = this.#call(GET, 'version');
        console.degug(result)
        return result;
    }

    triggerMessage(messageID, textFields) {
        var data = {};
        for (var key in textFields) {
            data.push({
                "name": key,
                "text": {
                    "text": textFields[key]
                }
            });
        }
    
        payload = JSON.stringify(data);
        
        success = this.#call(POST, 
            this.#endpoint('message', messageID, 'trigger'), payload);
    
        if (success) {
            console.log('Message sent successfully');
        } else {
            console.log('Error sending message');
        }

        return success
    }
}