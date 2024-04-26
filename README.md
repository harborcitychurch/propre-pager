This project is a work in progress and not feature complete

# An easy way to page parents with ProPresenter 7

## Requirements
- Python 3 installed on server *(tested with python 3.11.6)*

## Setting up ProPresenter
- Make a new message in propresenter called `parent-pager` that uses the fields `child#` and `room`
- Make sure ProPresenter has network enabled and take note of the **ip** and **port**

## Setting up ProPrePager
- In a text or code editor, open `pager.py` and make the following changes to the user configuration section at the top
    - Set `SERVERHOST` and `SERVERPORT` to the ip and port the server will be running from on the host machine
    - Edit the list of `ROOMS` to suit your needs
- Put your `header_logo.png`, `footer_logo.png`, and `favicon.ico` files in the html folder

## Running the server
1. Start the server with `python3 pager.py`

## To page a parent (childcare room page)
1. Open a web browser and navigate to the address you set on your server
2. Select the room the child is in
3. Type or scan the child's tag number
    - Both the webpage and server will check to make sure it is exactly 3 digits and numbers only, if you have different requirements you will need to change these settings yourself in `/html/index.html`, `/html/control.html`,  and `pager.py`
4. Hit submit

## Pager Dispatch (control page)
Currently all parent page requests are moderated manually from the `/control/` webpage
1. Make sure the ip address and port to the computer running ProPresenter is correct
    - A green bar will indicate the webpage can communicate with ProPresenter
2. When a page is queued, an alert sound will play
3. Click the `Send` button on the page you wish to display
