#! /usr/bin/env python3
# LICENSE: GNU GPL v3
# 
# ProPrePager - A simple pager server for children's ministry
#
# Galatians 6:9 Let’s not get tired of doing what is good, 
# for at the right time we will reap a harvest—if we do not give up.
#
# github.com/bluedog8050/ProPrePager

from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
from datetime import datetime, UTC, timedelta
import sqlite3
import uuid
import os
import json
import ssl
import signal

# try to load .env file
try:
    from dotenv import load_dotenv    
    load_dotenv()
except:
    pass

#########################################
####### BEGIN USER CONFIGURATION ########
#########################################

# SSL/TLS Configuration
USESSLTLS = os.getenv('USESSLTLS', 'false').lower() == 'true'
SSLCERT = os.getenv('SSLCERT', 'cert.pem')
SSLKEY = os.getenv('SSLKEY', 'key.pem')

# 0.0.0.0 for all interfaces
SERVERHOST = '0.0.0.0'

# Rooms Configuration (can be set manually like this: ROOMS = ['Room 1', 'Room 2', 'Room 3'])
ROOMS = os.getenv('ROOMS', '').split(',')
# Minutes until a page should not be shown in the viewer
PAGE_TIMEOUT = int(os.getenv('PAGE_TIMEOUT', 90))

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

INVALIDCHILDNUMBER_MSG = 'Invalid child number. Must be a 3-digit number.'

def validChildNumber(c):
    if len(c) == 3 and str(c).isdigit():
        return True
    else:
        return False

#########################################
####### END OF USER CONFIGURATION #######
#########################################

# Change to 443 if using SSL/TLS
SERVERPORT = 443 if USESSLTLS else 80

STATUS_CODES = ['queued', 'active', 'expired', 'failed', 'cancelled', 'auto', 'completed']

ENUM_LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

start_time = datetime.now(UTC)

server_address = (SERVERHOST, SERVERPORT)

class SimpleServer(BaseHTTPRequestHandler):
    propresenter_address = ''
    query = ''

    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        query = urlparse(self.path).query
        self.path = self.path.split('?')[0]

        #drop trailing slash
        if self.path.endswith('/'):
            self.path = self.path[:-1]

        if self.path == '/api/now':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S').encode('utf-8'))
        
        elif self.path == '/api/uptime':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            raw_uptime = datetime.now(UTC) - start_time
            days,remainder = divmod(raw_uptime.total_seconds(), 86400)
            hours,remainder = divmod(remainder, 3600)
            minutes,seconds = divmod(remainder, 60)
            uptime = f'{int(days)}:{str(int(hours)).zfill(2)}:{str(int(minutes)).zfill(2)}:{str(int(seconds)).zfill(2)}'
            self.wfile.write(uptime.encode('utf-8'))
       
        elif self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'OK')
        
        elif self.path == '/api/list':
            conn = sqlite3.connect('data/pager.db')
            c = conn.cursor()
            c.execute("SELECT * FROM pager_list WHERE timestamp >= ?", \
                      (datetime.strftime(datetime.now(UTC) - timedelta(minutes=PAGE_TIMEOUT), '%Y-%m-%d %H:%M:%S'),))
            rows = c.fetchall()
            conn.close()

            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            #send rows as JSON
            self.wfile.write(b'[')

            for row in rows:
                key = row[0]
                timestamp = row[1]
                child_number = row[2]
                room = row[3]
                status = row[4]
                try:
                    page_time = row[5]
                except:
                    page_time = ''
                self.wfile.write(f'{{"child_number": "{child_number}", "room": "{room}", "timestamp": "{timestamp}", \
                                 "status": "{status}", "key": "{key}", "page_time": "{page_time}"}}'.encode('utf-8'))
                if row != rows[-1]:
                    self.wfile.write(b',')
            self.wfile.write(b']')

        elif self.path == '/api/rooms':
            room_json = b'['
            for i, room in enumerate(ROOMS):
                room_json += f'{{"id":{i+1},"name":"{room}"}}'.encode('utf-8')
                if i != len(ROOMS) - 1:
                    room_json += b','
            room_json += b']'

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(room_json)

        elif self.path == '/api/active':
            conn = sqlite3.connect('data/pager.db')
            c = conn.cursor()
            c.execute("SELECT * FROM pager_list WHERE status = 'active'")
            rows = c.fetchall()
            conn.close()

            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            #send rows as JSON
            self.wfile.write(b'[')

            for row in rows:
                key = row[0]
                timestamp = row[1]
                child_number = row[2]
                room = row[3]
                status = row[4]
                try:
                    page_time = row[5]
                except:
                    page_time = ''
                self.wfile.write(f'{{"child_number": "{child_number}", "room": "{room}", "timestamp": "{timestamp}", \
                                 "status": "{status}", "page_time": "{page_time}", "key": "{key}"}}'.encode('utf-8'))
                if row != rows[-1]:
                    self.wfile.write(b',')
            self.wfile.write(b']')

        elif self.path == '/api/history':
            # get date range from query string
            query_components = parse_qs(query)
            if 'start' not in query_components:
                start_date = '1990-01-01 00:00:00'
            else:
                try:
                    start_date = query_components['start'][0] + ' 00:00:00'
                except Exception as e:
                    log('Invalid start date: ' + str(e))
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'400 Bad Request')
                    return
                
            if 'end' not in query_components:
                end_date = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
            else:
                try:
                    end_date = query_components['end'][0] + ' 23:59:59'
                except:
                    log('Invalid end date: ' + str(e))
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'400 Bad Request')
                    return

            #get requests within date range
            conn = sqlite3.connect('data/pager.db')
            c = conn.cursor()
            c.execute("SELECT * FROM pager_list WHERE timestamp BETWEEN ? AND ?", (start_date, end_date))
            rows = c.fetchall()
            conn.close()

            #send rows as JSON
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'[')

            for row in rows:
                key = row[0]
                timestamp = row[1]
                child_number = row[2]
                room = row[3]
                status = row[4]
                try:
                    page_time = row[5]
                except:
                    page_time = ''
                self.wfile.write(f'{{"child_number": "{child_number}", "room": "{room}", "timestamp": "{timestamp}", \
                                 "status": "{status}", "page_time": "{page_time}" "key": "{key}"}}'.encode('utf-8'))
                if row != rows[-1]:
                    self.wfile.write(b',')
            self.wfile.write(b']')

        #if not in /api, attempt to serve file. Prevent upwards traversal
        elif not self.path.startswith('/api/'):
            try:
                if self.path == '':
                    self.path = '/index.html'
                if self.path == '/control':
                    self.path = '/control.html'
                if self.path == '/viewer':
                    self.path = '/viewer.html'

                #this prevents directory traversal outside of the html directory
                if os.path.abspath(f'html{self.path}').startswith(os.path.abspath('html')):
                    with open(f'html{self.path}', 'rb') as f:
                        self.send_response(200)
                        #allow cross-origin requests
                        self.send_header('Access-Control-Allow-Origin', '*')
                        #cache images for 6 months
                        if self.path.endswith('.jpg') or self.path.endswith('.png'):
                            self.send_header('Cache-Control', 'max-age=15768000')
                        self.end_headers()
                        self.wfile.write(f.read())
                else:
                    self.send_response(403)
                    self.end_headers()
                    self.wfile.write(b'403 Forbidden')
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'404 Not Found')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def do_POST(self):
        if self.path == '/api/submit':
            
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            child_number = str(data['child_number'])
            room = str(data['room'])
            
            #check valid child_number
            if not validChildNumber(child_number):
                log(f'Invalid child number: {child_number} in room: {room}', 'WARNING')
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(INVALIDCHILDNUMBER_MSG.encode('utf-8'))
                return
            #sanitize room
            elif room not in ROOMS:
                log(f'Invalid room: {room}', 'WARNING')
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(f'Invalid room. Valid rooms are {ROOMS}.'.encode('utf-8'))
                return
            else:
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                

                #get timestamp from db
                timestamp = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
                key = str(uuid.uuid4())

                # Write data to SQLite database
                conn = sqlite3.connect('data/pager.db')
                c = conn.cursor()
                c.execute("INSERT INTO pager_list VALUES (?, ?, ?, ?, ?, '')",
                            (key, timestamp, child_number, room, 'queued'))
                conn.commit()
                conn.close()

                self.wfile.write(b'Page has been queued successfully!')
                log(f'Page queued - child number: {child_number} in room: {room}', 'DEBUG')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def do_PUT(self):
        if self.path == '/api/report':
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                content_length = int(self.headers['Content-Length'])
                put_data = self.rfile.read(content_length).decode('utf-8')
                data = json.loads(put_data)
                key = data['key']
                status = data['status']
                
                #sanitize status and uuid
                if status not in STATUS_CODES:
                    self.wfile.write(f'Invalid status. Valid codes are {STATUS_CODES}'.encode('utf-8'))
                    log(f'Invalid status: {status}', 'WARNING')
                    return
                if not uuid.UUID(key):
                    self.wfile.write(b'Invalid Item Key. Must be a valid UUID.')
                    log(f'Invalid key: {key}', 'WARNING')
                    return
                
                if status == 'active':
                    page_time = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
                else:
                    page_time = ''
                
                # Update data in SQLite database
                conn = sqlite3.connect('data/pager.db')
                c = conn.cursor()
                try:
                    c.execute("UPDATE pager_list SET status = ? WHERE key = ?", (status, key))
                    conn.commit()
                    if page_time:
                        has_page_time = c.execute("SELECT page_time FROM pager_list WHERE key = ?", (key,)).fetchone()
                        if not has_page_time:
                            c.execute("UPDATE pager_list SET page_time = ? WHERE key = ?", (page_time, key))
                            conn.commit()
                    conn.close()
                    self.wfile.write(b'Status updated successfully!')
                    log(f'Status updated to {status} for key: {key}', 'DEBUG')
                except sqlite3.Error as e:
                    self.wfile.write(b'Database Error, status may not have been updated.')
                    log('In api/report: ' + str(e), 'ERROR')
                    
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

httpd = HTTPServer(server_address, SimpleServer)
if USESSLTLS:
    httpd.socket = ssl.wrap_socket(httpd.socket, certfile=SSLCERT, keyfile=SSLKEY, server_side=True)

def handle_sigterm(signum, frame):
    log('Received SIGTERM signal. Server shutting down...')
    httpd.server_close()
    log('Server shut down.')
    exit(0)

def initialize_database():
    # Connect to the SQLite database (or create it)
    db = sqlite3.connect('data/pager.db')
    cursor = db.cursor()

    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pager_list(
            key TEXT PRIMARY KEY,
            timestamp TEXT,
            child_number TEXT,
            room TEXT,
            status TEXT,
            page_time TEXT
        )
    ''')

    # Commit the transaction
    db.commit()

    # Close the connection
    db.close()


def log(message, level='INFO'):
    if not LOG_LEVEL in ENUM_LOG_LEVELS:
        timestamp = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
        log_entry = f'{timestamp} [{level}] {message}'
        with open('data/server.log', 'a') as log_file:
            log_file.write(log_entry + '\n')
            print(log_entry)
    if ENUM_LOG_LEVELS.index(level) >= ENUM_LOG_LEVELS.index(LOG_LEVEL):
        timestamp = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
        log_entry = f'{timestamp} [{level}] {message}'
        with open('data/server.log', 'a') as log_file:
            log_file.write(log_entry + '\n')
            print(log_entry)

def run_server():
    # Register the signal handler for SIGTERM
    signal.signal(signal.SIGTERM, handle_sigterm)

    if LOG_LEVEL not in ENUM_LOG_LEVELS:
        log(f'Invalid log level: {LOG_LEVEL}, defaulting to DEBUG', 'WARNING')

    try:
        initialize_database()
    except:
        log('Error initializing database', 'ERROR')
        return
    
    log(f'Starting server on {SERVERHOST}:{SERVERPORT}...')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log('KeyboardInterrupt: Server shutting down...')
        httpd.server_close()
        log('Server shut down.')
    
try:
    run_server()
except Exception as e:
    log(f'Error: {e}', 'CRITICAL')
    