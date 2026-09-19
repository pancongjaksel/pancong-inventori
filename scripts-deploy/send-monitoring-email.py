#!/usr/bin/env python3
import os
import smtplib
import sys
from email.message import EmailMessage

subject, body = sys.argv[1], sys.argv[2]
sender = os.environ['MONITORING_EMAIL_FROM']
recipient = os.environ.get('MONITORING_EMAIL_TO', sender)

message = EmailMessage()
message['Subject'] = subject
message['From'] = sender
message['To'] = recipient
message.set_content(body)

with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as smtp:
    smtp.starttls()
    smtp.login(sender, os.environ['GMAIL_APP_PASSWORD'])
    smtp.send_message(message)
