#! /usr/bin/env python3

# USER CONFIGURATION #
SERVERHOST = 'localhost'
SERVERPORT = 8000
ROOMS = ['Boardwalk', 'Meadow', 'Alpine', 'Uptown', 'Wonder Kids']
## END OF USER CONFIGURATION ##

from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
from datetime import datetime, UTC
import sqlite3
import uuid
import os
import json

STATUS_CODES = ['queued', 'active', 'expired', 'failed', 'cancelled']

def initialize_database():
    # Connect to the SQLite database (or create it)
    db = sqlite3.connect('pager.db')

    # Create a cursor object
    cursor = db.cursor()

    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pager_list(
            key TEXT PRIMARY KEY,
            timestamp TEXT,
            child_number TEXT,
            room TEXT,
            status TEXT
        )
    ''')

    # Commit the transaction
    db.commit()

    # Close the connection
    db.close()

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

        if self.path == '/api/now':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            #get current time from database
            conn = sqlite3.connect('pager.db')
            c = conn.cursor()
            c.execute("SELECT datetime('now')")
            row = c.fetchone()
            conn.close()

            # Create a dictionary with the current server time and database time
            data = {
                'server_time': datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S'),
                'db_time': row[0]
            }

            # Convert the dictionary to a JSON string
            json_data = json.dumps(data)

            # Write the JSON string to the response
            self.wfile.write(json_data.encode('utf-8'))

            self.wfile.close()

        elif self.path == '/api/list':
            
            conn = sqlite3.connect('pager.db')
            c = conn.cursor()
            c.execute("SELECT * FROM pager_list WHERE timestamp >= datetime('now', '-12 hour')")
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
                self.wfile.write(f'{{"child_number": "{child_number}", "room": "{room}", "timestamp": "{timestamp}", "status": "{status}", "key": "{key}", "page_time": "{page_time}"}}'.encode('utf-8'))
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

        elif self.path == '/api/history':
            # get date range from query string
            query_components = parse_qs(query)
            if 'start' not in query_components:
                start_date = '1990-01-01 00:00:00'
            else:
                try:
                    start_date = query_components['start'][0] + ' 00:00:00'
                except Exception as e:
                    print('Invalid start date')
                    print(e)
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
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'400 Bad Request')
                    return

            #get requests within date range
            conn = sqlite3.connect('pager.db')
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
                self.wfile.write(f'{{"child_number": "{child_number}", "room": "{room}", "timestamp": "{timestamp}", "status": "{status}", "page_time": "{page_time}" "key": "{key}"}}'.encode('utf-8'))
                if row != rows[-1]:
                    self.wfile.write(b',')
            self.wfile.write(b']')

        #if not in /api, attempt to serve file. Prevent upwards traversal
        elif not self.path.startswith('/api/'):
            try:
                if self.path == '/':
                    self.path = '/index.html'
                if self.path == '/control/':
                    self.path = '/control.html'

                #this prevents directory traversal outside of the html directory
                if os.path.abspath(f'html{self.path}').startswith(os.path.abspath('html')):
                    with open(f'html{self.path}', 'rb') as f:
                        self.send_response(200)
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
            child_number = data['child_number']
            room = data['room']
            
            #check valid child_number
            if not len(child_number) == 3 or not str(child_number).isdigit():
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'Invalid child number. Must be a 3-digit number.')
                return
            #sanitize room
            elif room not in ROOMS:
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
                conn = sqlite3.connect('pager.db')
                timestamp = datetime.strftime(datetime.now(UTC), '%Y-%m-%d %H:%M:%S')
                key = str(uuid.uuid4())

                # Write data to SQLite database
                conn = sqlite3.connect('pager.db')
                c = conn.cursor()
                c.execute("INSERT INTO pager_list VALUES (?, ?, ?, ?, ?)",
                            (key, timestamp, child_number, room, 'queued'))
                conn.commit()
                conn.close()

                self.wfile.write(b'Page has been queued successfully!')
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
                    return
                if not uuid.UUID(key):
                    self.wfile.write(b'Invalid Item Key. Must be a valid UUID.')
                    return
                
                # Update data in SQLite database
                conn = sqlite3.connect('pager.db')
                c = conn.cursor()
                try:
                    c.execute("UPDATE pager_list SET status = ? WHERE key = ?", (status, key))
                    conn.commit()
                    conn.close()
                    self.wfile.write(b'Status updated successfully!')
                except sqlite3.Error as e:
                    self.wfile.write(f'''
                        <html>
                            <body>
                                <a href="/">Back</a>
                                <h2>Error</h2>
                                <p>{e}</p>
                            </body>
                        </html>
                    ''')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    

def run_server():
    server_address = (SERVERHOST, SERVERPORT)
    httpd = HTTPServer(server_address, SimpleServer)
    initialize_database()
    print(f'Starting server on {SERVERHOST}:{SERVERPORT}...')
    httpd.serve_forever()

run_server()