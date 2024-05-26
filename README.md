# A simple way for childcare workers to page parents with ProPresenter 7

## Requirements
- Python 3 installed on server *(tested with python 3.11.6)*
- Server, control computer/tablet, and ProPresenter must be on the same local network to avoid CORS issues in browser
    - Classroom pager may be allowed access from any origin

## Setting up ProPresenter
- Make a new message in propresenter called `parent-pager` that uses the fields `child#` and `room`
- Make sure ProPresenter has network enabled and take note of the **ip** and **port**

## Setting up ProPrePager
- Create a new text file called `.env` and add any of the following values:
```
ROOMS=Room 1,Room 2,Room 3
USESSLTLS=False
SSLCERT=cert.pem
SSLKEY=key.pem
LOG_LEVEL=DEBUG 
```
- Save the file in the ProPrePager project directory
- Put your `header_logo.png`, `footer_logo.png`, and `favicon.ico` files in `/html`
- By default, the server will validate child numbers to make sure they are exactly 3 digits and numbers only, if you have different requirements you will need to change the checks in `validChildNumber(c)` at the top of `pager.py` as well as the `INVALIDCHILDNUMBER_MSG` error message to match

## Running the server directly
- Start the server with `python3 pager.py`

## Running the server in a docker container
- To Build and start the container run `docker-compose up -d`
- Run `docker ps` to find your container and which ports you will use to connect to it
- Docker settings can be changed in the `docker-compose.yml`

# To page a parent (childcare room page)
1. Open a web browser and navigate to the address of your server
2. Select the room the child is in
3. Type or scan the child's tag number
4. Hit Submit

# Pager dispatch (control page)
Currently all parent page requests are moderated manually from the `/control` webpage
1. Make sure the ip address and port to the computer running ProPresenter is correct
    - A green bar will indicate the webpage can communicate with ProPresenter
2. When a page is queued, an alert sound will play
3. Hit the `Send` button on the row with the number you wish to display
